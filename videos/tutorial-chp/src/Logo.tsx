import type React from "react";
import { Img, staticFile } from "remotion";
import { C } from "./theme";

/** Logo del CHP: blanco sobre fondos oscuros; granate (con la imagen como máscara) sobre fondos claros. */
export const Logo: React.FC<{ readonly claro: boolean; readonly ancho: number; readonly style?: React.CSSProperties }> = ({ claro, ancho, style }) =>
  claro ? (
    <div style={{
      width: ancho, height: (ancho * 122) / 458, backgroundColor: C.granate,
      WebkitMaskImage: `url(${staticFile("logo-chp.png")})`, WebkitMaskSize: "contain", WebkitMaskRepeat: "no-repeat",
      maskImage: `url(${staticFile("logo-chp.png")})`, maskSize: "contain", maskRepeat: "no-repeat", ...style,
    }} />
  ) : (
    <Img src={staticFile("logo-chp.png")} style={{ width: ancho, ...style }} />
  );
