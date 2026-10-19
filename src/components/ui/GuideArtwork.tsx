import Image from 'next/image'

// The supplied Arabic cover was redrawn at high resolution, then exported
// as a compact WebP. Keep its full page proportions visible in the device.
export function GuideArtwork() {
  return (
    <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',background:'radial-gradient(ellipse at 50% 40%,#EDE8FF 0%,#F8F6FC 55%,#FAFAFA 100%)',padding:'4%'}}>
      <div style={{height:'100%',aspectRatio:'960 / 1373',maxWidth:'100%',padding:'clamp(5px,1vw,9px)',borderRadius:16,background:'#251E38',boxShadow:'0 16px 36px -14px rgba(38,33,92,.45)',border:'1px solid #4A4060'}}>
        <Image src="/rwnak-guide-cover-ar.webp" alt="غلاف النسخة العربية من دليل رونق: دليل التدبير المنزلي — بيوت الخليج" width={960} height={1373} preload sizes="(max-width: 640px) 160px, (max-width: 900px) 240px, 300px" style={{display:'block',width:'100%',height:'100%',objectFit:'contain',borderRadius:9}} />
      </div>
    </div>
  )
}
