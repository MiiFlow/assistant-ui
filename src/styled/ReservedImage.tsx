import type { ImgHTMLAttributes } from "react";

/** Reserve the preview before download/decode. Unknown dimensions use a fixed
 * box; natural image dimensions never resize a transcript after it is shown. */
export function ReservedImage({
  width = 320,
  height = 240,
  style,
  ...props
}: ImgHTMLAttributes<HTMLImageElement>) {
  return (
    <img
      {...props}
      width={width}
      height={height}
      style={{
        display: "inline-block",
        width: Number(width),
        maxWidth: "100%",
        height: "auto",
        aspectRatio: `${width} / ${height}`,
        objectFit: "contain",
        ...style,
      }}
    />
  );
}
