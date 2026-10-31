export default function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <img
      src="/image.png"
      alt="SMAJ AI"
      width={1254}
      height={1254}
      className={`brandLogo ${className}`.trim()}
    />
  );
}
