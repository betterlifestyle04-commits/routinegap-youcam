// Perfect Corp YouCam Skin Analysis V2.0 SD image dimensions:
// short side >= 480 px, long side <= 2560 px.
// See https://docs.perfectcorp.com/reference/ai_skin_analysis/section/overview/file-specs-and-errors
// Parse headers only; do not decode, store or log the user's face.
export function imageDimensions(bytes,mime){
  if(!(bytes instanceof Uint8Array))throw new Error('Image bytes required.');
  if(mime==='image/png'){
    if(bytes.length<24||!bytes.subarray(0,8).every((x,i)=>x===[137,80,78,71,13,10,26,10][i])||
       String.fromCharCode(...bytes.subarray(12,16))!=='IHDR')throw new Error('Invalid PNG header.');
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    return {width:view.getUint32(16),height:view.getUint32(20)};
  }
  if(mime==='image/jpeg'){
    if(bytes.length<8||bytes[0]!==255||bytes[1]!==216)throw new Error('Invalid JPEG header.');
    let pos=2;
    while(pos+8<bytes.length){
      if(bytes[pos]!==255){pos++;continue;}
      while(bytes[pos]===255)pos++;
      const marker=bytes[pos++];
      if(marker===0xd8||marker===0x01||marker>=0xd0&&marker<=0xd7)continue;
      if(marker===0xd9||marker===0xda)break;
      if(pos+2>bytes.length)break;
      const length=bytes[pos]*256+bytes[pos+1];
      if(length<2||pos+length>bytes.length)break;
      if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)){
        if(length<7)break;
        return {height:bytes[pos+3]*256+bytes[pos+4],width:bytes[pos+5]*256+bytes[pos+6]};
      }
      pos+=length;
    }
    throw new Error('Cannot read JPEG dimensions.');
  }
  throw new Error('Upload a JPEG or PNG image.');
}
export function validSkinAnalysisDimensions({width,height}){
  return Number.isInteger(width)&&Number.isInteger(height)&&Math.min(width,height)>=480&&Math.max(width,height)<=2560;
}
export function skinDimensionMessage({width,height}){
  return 'This photo is '+width+' × '+height+' pixels. YouCam standard skin analysis needs at least 480 px on the shorter side and at most 2560 px on the longer side. Choose a clear, higher-resolution front-facing photo; enlarging a tiny image does not restore skin detail.';
}
