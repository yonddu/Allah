from PIL import Image,ImageOps,ImageDraw
from pathlib import Path
import numpy as np,json,sys
from scipy.ndimage import distance_transform_edt
root=Path(sys.argv[1]) if len(sys.argv)>1 else Path('references');out=Path('public/reference-assets');out.mkdir(exist_ok=True)
faces=[('01-31824.png',(539,1,677,175)),('02-31825.png',(532,10,662,182)),('03-31826.png',(532,9,661,180)),('05-31823.png',(536,4,678,181)),('06-31820.png',(537,9,676,184)),('08-31822.png',(488,15,652,212)),('07-31821.png',(710,9,826,151))]
atlas=Image.new('RGB',(1024,512));skin=[]
for i,(name,box) in enumerate(faces):
    im=Image.open(root/name).convert('RGBA').crop(box);a=np.array(im);rgb=a[:,:,:3];mask=a[:,:,3]>200
    # Fill transparent margins from the nearest foreground for a clean projection onto a 3D head.
    idx=distance_transform_edt(~mask,return_distances=False,return_indices=True);rgb=rgb[tuple(idx)]
    tile=Image.fromarray(rgb).resize((256,240),Image.Resampling.LANCZOS)
    x=(i%4)*256;y=(i//4)*256;atlas.paste(tile,(x,y))
    color=np.median(a[int(a.shape[0]*.55):int(a.shape[0]*.70),int(a.shape[1]*.24):int(a.shape[1]*.40),:3].reshape(-1,3),axis=0).astype(int)
    color=tuple(int(v) for v in color);skin.append(color)
    ImageDraw.Draw(atlas).rectangle((x,y+240,x+127,y+255),fill=color)
    ImageDraw.Draw(atlas).rectangle((x+128,y+240,x+255,y+255),fill=(34,29,24))
    im.thumbnail((128,160));thumb=Image.new('RGB',(128,160),(31,50,43));thumb.paste(im,((128-im.width)//2,(160-im.height)//2),im.getchannel('A'));thumb.save(out/f'face{i+1:02}.webp',quality=89)
atlas.save(out/'faces-high.webp',quality=91);atlas.resize((512,256),Image.Resampling.LANCZOS).save(out/'faces-low.webp',quality=87)
sheet=Image.open(root/'04-31827.png').convert('RGBA');cloth=Image.new('RGB',(1024,1024));thumbs=Image.new('RGBA',(640,768))
for i in range(15):
    row=i//5;col=i%5;y0,y1=[(6,399),(410,855),(877,1408)][row];x0=round(col*sheet.width/5);x1=round((col+1)*sheet.width/5)
    tile=sheet.crop((x0,y0,x1,y1));a=np.array(tile);mask=a[:,:,3]>180;idx=distance_transform_edt(~mask,return_distances=False,return_indices=True);rgb=a[:,:,:3][tuple(idx)]
    # Each outfit retains its own cap/scarf, embroidery, vest, colors and fabric from the supplied sheet.
    x=round(col*1024/5);xn=round((col+1)*1024/5);y=round(row*1024/3);yn=round((row+1)*1024/3)
    cloth.paste(Image.fromarray(rgb).resize((xn-x,yn-y),Image.Resampling.LANCZOS),(x,y))
    thumbs.paste(tile.resize((128,256),Image.Resampling.LANCZOS),(col*128,row*256))
cloth.save(out/'clothes-high.webp',quality=93);cloth.resize((512,512),Image.Resampling.LANCZOS).save(out/'clothes-low.webp',quality=88);thumbs.save(out/'wardrobe.webp',quality=88)
(out/'provenance.json').write_text(json.dumps({'source':'User-supplied reference images, 2026-11-05','faces':[v[0] for v in faces],'clothing':'04-31827.png','note':'Front-image projection for mobile 3D meshes. Back and side geometry are approximations; no claim of exact 3D reconstruction.','skin':skin},ensure_ascii=False))
print(json.dumps({'bytes':sum(p.stat().st_size for p in out.iterdir()),'files':len(list(out.iterdir())),'skin':skin}))
