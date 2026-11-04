"""纯 Python PNG 读写 + 最近邻缩放（无 Pillow 依赖）。"""
import zlib, struct

def read_png(path):
    d = open(path, 'rb').read()
    assert d[:8] == b'\x89PNG\r\n\x1a\n', 'not png'
    pos = 8
    idat = b''
    w = h = bitd = ct = None
    plte = None
    trns = None
    while pos < len(d):
        ln = struct.unpack('>I', d[pos:pos+4])[0]
        typ = d[pos+4:pos+8]
        data = d[pos+8:pos+8+ln]
        if typ == b'IHDR':
            w, h, bitd, ct, comp, filt, inter = struct.unpack('>IIBBBBB', data)
            assert inter == 0, 'interlaced not supported'
        elif typ == b'PLTE':
            plte = data
        elif typ == b'tRNS':
            trns = data
        elif typ == b'IDAT':
            idat += data
        elif typ == b'IEND':
            break
        pos += 12 + ln
    raw = zlib.decompress(idat)
    nch = {0:1, 2:3, 3:1, 4:2, 6:4}[ct]
    assert bitd == 8, f'bitdepth {bitd} not supported'
    bpp = nch
    stride = w * bpp
    out = bytearray(h * stride)
    prev = bytearray(stride)
    p = 0
    for y in range(h):
        f = raw[p]; p += 1
        line = bytearray(raw[p:p+stride]); p += stride
        if f == 1:
            for i in range(bpp, stride): line[i] = (line[i] + line[i-bpp]) & 255
        elif f == 2:
            for i in range(stride): line[i] = (line[i] + prev[i]) & 255
        elif f == 3:
            for i in range(stride):
                a = line[i-bpp] if i >= bpp else 0
                line[i] = (line[i] + ((a + prev[i]) >> 1)) & 255
        elif f == 4:
            for i in range(stride):
                a = line[i-bpp] if i >= bpp else 0
                b = prev[i]
                c = prev[i-bpp] if i >= bpp else 0
                pa = abs(b - c); pb = abs(a - c); pc = abs(a + b - 2*c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[i] = (line[i] + pr) & 255
        out[y*stride:(y+1)*stride] = line
        prev = line
    # 归一化到 RGBA
    rgba = bytearray(w*h*4)
    for y in range(h):
        for x in range(w):
            i = y*stride + x*bpp
            if ct == 6:
                r,g,b,a = out[i], out[i+1], out[i+2], out[i+3]
            elif ct == 2:
                r,g,b,a = out[i], out[i+1], out[i+2], 255
            elif ct == 0:
                r=g=b=out[i]; a=255
            elif ct == 4:
                r=g=b=out[i]; a=out[i+1]
            elif ct == 3:
                idx = out[i]
                r,g,b = plte[idx*3], plte[idx*3+1], plte[idx*3+2]
                a = trns[idx] if trns and idx < len(trns) else 255
            j = (y*w+x)*4
            rgba[j], rgba[j+1], rgba[j+2], rgba[j+3] = r,g,b,a
    return w, h, rgba

def write_png(path, w, h, rgba):
    raw = bytearray()
    for y in range(h):
        raw.append(0)
        raw += rgba[y*w*4:(y+1)*w*4]
    def chunk(t, d):
        c = struct.pack('>I', len(d)) + t + d
        return c + struct.pack('>I', zlib.crc32(t+d) & 0xffffffff)
    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(bytes(raw), 9))
    png += chunk(b'IEND', b'')
    open(path, 'wb').write(png)

def resize(w, h, rgba, nw, nh):
    out = bytearray(nw*nh*4)
    for y in range(nh):
        sy = y*h//nh
        for x in range(nw):
            sx = x*w//nw
            si = (sy*w+sx)*4
            di = (y*nw+x)*4
            out[di:di+4] = rgba[si:si+4]
    return out


# ---------- 命令行入口：生成 PWA 全套图标 ----------
def flatten_on_white(img, tw, th):
    """把带透明通道的图铺到白底上（iOS apple-touch-icon 不支持透明）。"""
    flat = bytearray(tw*th*4)
    for y in range(th):
        for x in range(tw):
            i = (y*tw+x)*4
            a = img[i+3]
            for k in range(3):
                flat[i+k] = (img[i+k]*a + 255*(255-a))//255
            flat[i+3] = 255
    return flat


def make_maskable(w, h, rgba, tw, th, bg=(0x12, 0x10, 0x18)):
    """maskable 图标：内容缩到 80% 居中，四周留安全边距，底色不透明。"""
    inner = int(tw*0.8)
    small = resize(w, h, rgba, inner, inner)
    canvas = bytearray(bytes(bg + (255,)) * (tw*th))
    off = (tw-inner)//2
    for y in range(inner):
        for x in range(inner):
            si = (y*inner+x)*4
            if small[si+3]:
                di = ((y+off)*tw + (x+off))*4
                canvas[di:di+4] = small[si:si+4]
    return canvas


def gen_icons(src, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    w, h, rgba = read_png(src)
    print(f'源图标: {w}x{h}  ->  {out_dir}')
    jobs = [
        ('icon-192.png', 192, 192, 'any'),
        ('icon-512.png', 512, 512, 'any'),
        ('apple-touch-icon.png', 180, 180, 'apple'),
        ('icon-maskable-192.png', 192, 192, 'maskable'),
        ('icon-maskable-512.png', 512, 512, 'maskable'),
    ]
    for name, tw, th, kind in jobs:
        if kind == 'maskable':
            img = make_maskable(w, h, rgba, tw, th)
        else:
            img = resize(w, h, rgba, tw, th)
            if kind == 'apple':
                img = flatten_on_white(img, tw, th)
        p = os.path.join(out_dir, name)
        write_png(p, tw, th, img)
        print(f'  {name}  {tw}x{th}  {os.path.getsize(p)} bytes')
    return out_dir


if __name__ == '__main__':
    import os
    import sys
    here = os.path.dirname(os.path.abspath(__file__))
    repo = os.path.dirname(here)
    src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(repo, 'assets', 'icon.png')
    out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(repo, 'assets', 'pwa')
    gen_icons(src, out)
    print('完成。')

