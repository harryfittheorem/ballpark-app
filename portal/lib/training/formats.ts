export const TRAINING_MIMES:Record<string,string>={
  pdf:'application/pdf',txt:'text/plain',text:'text/plain',csv:'text/csv',
  jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',gif:'image/gif',webp:'image/webp',
  mp4:'video/mp4',webm:'video/webm',mp3:'audio/mpeg',
  doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls:'application/vnd.ms-excel',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt:'application/vnd.ms-powerpoint',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  zip:'application/zip',
};
export const trainingFileMime=(name:string)=>TRAINING_MIMES[name.split('.').at(-1)?.toLowerCase() ?? ''] ?? null;
export const TRAINING_ACCEPT=Object.keys(TRAINING_MIMES).map(ext=>'.'+ext).join(',');
