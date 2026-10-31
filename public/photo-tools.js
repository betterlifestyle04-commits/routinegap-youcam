/** Browser-only, non-generative photo preparation.
 * All operations remain local until the user explicitly consents to a YouCam scan.
 */
export const PHOTO_MIN_SHORT=480;
export const PHOTO_MAX_LONG=2560;
export const PHOTO_UPLOAD_MAX_BYTES=8*1024*1024;
export const PHOTO_SOURCE_MAX_BYTES=24*1024*1024;
export const PHOTO_SOURCE_MAX_PIXELS=32_000_000;

export function planLocalPhoto({width,height,size,type}){
  const unsupported={status:'unsupported',reason:'Use a valid JPG or PNG photo.'};
  if(!['image/jpeg','image/png'].includes(type))return unsupported;
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<=0||height<=0||
     !Number.isFinite(size)||size<1500)return unsupported;
  if(size>PHOTO_SOURCE_MAX_BYTES)return {status:'unsupported',reason:'This original file exceeds the 24 MB browser preparation limit. Use a full-resolution photo under 24 MB or downsize it locally with Squoosh.'};
  if(Math.min(width,height)<PHOTO_MIN_SHORT)return {status:'too-small',reason:'This photo is '+width+' × '+height+' px. YouCam requires at least 480 px on the shorter side. Get the original full-resolution photo or retake it; enlarging cannot recover real skin detail.'};
  if(width*height>PHOTO_SOURCE_MAX_PIXELS)return {status:'unsupported',reason:'This photo is too large for safe browser preparation. Downsize the original to at most 2,560 px on the longer side with a photo editor.'};
  const scale=Math.min(1,PHOTO_MAX_LONG/Math.max(width,height));
  const outWidth=Math.max(1,Math.round(width*scale));
  const outHeight=Math.max(1,Math.round(height*scale));
  if(Math.min(outWidth,outHeight)<PHOTO_MIN_SHORT)
    return {status:'unsupported',reason:'A proportional resize would make the shorter side smaller than 480 px. Choose a better-framed original image with the whole face visible.'};
  const needsPreparation=Math.max(width,height)>PHOTO_MAX_LONG||size>PHOTO_UPLOAD_MAX_BYTES;
  return {status:needsPreparation?'prepare':'ready',width:outWidth,height:outHeight,originalWidth:width,originalHeight:height,reason:needsPreparation?'Resize the original locally to meet YouCam limits. This will not apply any AI enhancements or upload your photo.':'Photo meets the size and pixel limits.'};
}

function canvasJpeg(canvas,quality){
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Could not export the prepared image.')),'image/jpeg',quality));
}
export async function preparePhotoLocally(source){
  if(typeof document==='undefined'||typeof createImageBitmap!=='function')
    throw new Error('Local photo preparation is not supported in this browser. Try Chrome, Edge or Safari, or use Squoosh.');
  if(!source||source.size>PHOTO_SOURCE_MAX_BYTES||source.size<1500||!['image/jpeg','image/png'].includes(source.type))
    throw new Error('Choose a valid JPG or PNG original under 24 MB.');
  let bitmap;
  try{
    bitmap=await createImageBitmap(source);
    const plan=planLocalPhoto({width:bitmap.width,height:bitmap.height,size:source.size,type:source.type});
    if(plan.status!=='prepare')throw new Error(plan.status==='ready'?'This photo already meets YouCam requirements.':plan.reason);
    const canvas=document.createElement('canvas');
    canvas.width=plan.width;canvas.height=plan.height;
    const context=canvas.getContext('2d',{alpha:false});
    if(!context)throw new Error('This browser could not prepare the image. Use Squoosh instead.');
    context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';
    context.drawImage(bitmap,0,0,plan.width,plan.height);
    for(const quality of [0.92,0.86,0.78,0.7]){
      const blob=await canvasJpeg(canvas,quality);
      if(blob.size<=PHOTO_UPLOAD_MAX_BYTES&&blob.size>=1500){
        const newName=(source.name||'skin-photo').replace(/\.(jpe?g|png)$/i,'').slice(0,75)+'-prepared.jpg';
        const file=new File([blob],newName,{type:'image/jpeg'});
        return {file,width:plan.width,height:plan.height};
      }
    }
    throw new Error('The prepared photo still exceeds 8 MB. Resize a high-quality original in Squoosh, or retake the image.');
  }finally{bitmap?.close?.();}
}
