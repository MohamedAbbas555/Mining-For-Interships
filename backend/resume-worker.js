import {parentPort,workerData} from 'node:worker_threads';
try{
  const bytes=Buffer.from(workerData.bytes);let text;
  if(workerData.ext==='pdf'){
    const {PDFParse}=await import('pdf-parse');const parser=new PDFParse({data:bytes});
    try{const info=await parser.getInfo();if(info.total>30)throw Error('Resume PDF exceeds 30 pages.');text=(await parser.getText()).text;}finally{await parser.destroy();}
  }else{
    // Bound declared decompression size before handing the archive to the DOCX parser.
    let total=0;for(let i=0;i+46<=bytes.length;i++){if(bytes.readUInt32LE(i)===0x02014b50){total+=bytes.readUInt32LE(i+24);if(total>32*1024*1024)throw Error('DOCX expands beyond the allowed size.');}}
    const mammoth=await import('mammoth');text=(await mammoth.default.extractRawText({buffer:bytes})).value;
  }
  parentPort.postMessage({text});
}catch{parentPort.postMessage({error:'This file could not be read. It may be damaged, encrypted or too complex. Export a new PDF, DOCX or TXT file.'});}
