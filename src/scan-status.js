/**
 * Fixed, safety-reviewed user guidance for Perfect Corp task failures.
 * No raw vendor error body is returned to the browser or logged.
 * Cosmetic only. A failed task is never replaced by sample results.
 */
const guidance=Object.freeze({
  error_no_face:'No face was detected. Retake a clear, front-facing photo with your full face visible.',
  error_multiple_people:'More than one person was detected. Use a photo of one consenting person only.',
  error_face_position_too_small:'The face occupies too little of the image. Move closer so the face is clearly visible.',
  error_face_position_out_of_boundary:'Some of the face is outside the image. Retake the photo with the whole face inside the frame.',
  error_face_position_invalid:'The face was not positioned clearly enough. Look straight at the camera and keep the forehead and cheeks visible.',
  error_insufficient_lighting:'The image lighting was insufficient. Retake it facing a window with soft, even light.',
  error_face_angle_invalid:'The face angle was unsuitable. Face the camera directly and keep your head level.',
  error_large_face_angle:'The face angle was too large. Retake the photo looking straight at the camera.',
  error_below_min_image_size:'The photo resolution was too low. Use an original with at least 480 pixels on its shorter side.',
  error_decode_image:'YouCam could not decode this photo. Export a valid JPG or PNG from the original without beauty filters.',
  error_download_image:'YouCam could not access the uploaded photo. The provider transfer may have expired; contact the project owner before resubmitting.',
  exceed_max_filesize:'The original image exceeded the provider size limit. Prepare an image smaller than 8 MB locally.',
  error_unsupport_ratio:'The photo aspect ratio was unsupported. Use a normal front-facing portrait that includes the complete face.',
  error_inference:'The provider encountered an image-analysis error. Do not repeatedly resubmit; try a new suitable photo later.',
  error_upload:'The provider had trouble uploading the result. Contact the project owner before starting another paid scan.'
});
const fallback='YouCam could not analyze this image. Review the photo preparation guide, then use a new suitable original only if needed.';
function getErrorCode(payload){
  const data=payload?.data;
  const values=[data?.error_code,data?.failure_reason,data?.error?.code,data?.error?.error_code,data?.error,payload?.error_code];
  for(const value of values){
    if(typeof value!=='string'||value.length>250)continue;
    const normalized=value.trim().toLowerCase();
    if(Object.hasOwn(guidance,normalized))return normalized;
    // Some responses embed a known code in a short sentence.
    const match=normalized.match(/\b(error_[a-z0-9_]+|exceed_max_filesize)\b/);
    if(match&&Object.hasOwn(guidance,match[1]))return match[1];
  }
  return null;
}
export function taskStatusResult(payload){
  const state=payload?.data?.task_status;
  if(state==='success')return {state:'success'};
  if(state==='error'||state==='failed'){
    const code=getErrorCode(payload);
    return {state:'error',message:code?guidance[code]:fallback};
  }
  if(['running','queued','processing','pending'].includes(state))return {state:'running'};
  throw new Error('YouCam returned an unknown task status. The existing task may still be active; resume it later instead of starting a new paid scan.');
}
