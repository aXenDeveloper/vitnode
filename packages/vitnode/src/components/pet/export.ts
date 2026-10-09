import { PET_CSS } from "./styles";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const EXPORT_BOX = { height: 488, width: 496, x: -48, y: -24 };
const PNG_WIDTH = 1024;

export const getPetSvgMarkup = (
  svg: SVGSVGElement,
  { animated = true }: { animated?: boolean } = {},
) => {
  const clone = svg.cloneNode(true) as SVGSVGElement;

  clone.setAttribute("class", "vitnode-pet");
  clone.removeAttribute("aria-hidden");
  clone.removeAttribute("data-pet-state");
  clone.setAttribute(
    "viewBox",
    `${EXPORT_BOX.x} ${EXPORT_BOX.y} ${EXPORT_BOX.width} ${EXPORT_BOX.height}`,
  );
  clone.setAttribute("width", String(EXPORT_BOX.width));
  clone.setAttribute("height", String(EXPORT_BOX.height));

  if (animated) {
    const style = document.createElementNS(SVG_NAMESPACE, "style");
    style.textContent = PET_CSS;
    clone.prepend(style);
  }

  return new XMLSerializer().serializeToString(clone);
};

const saveBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
};

export const downloadPetSvg = (svg: SVGSVGElement, fileName: string) => {
  saveBlob(
    new Blob([getPetSvgMarkup(svg)], { type: "image/svg+xml" }),
    `${fileName}.svg`,
  );
};

export const downloadPetPng = async (svg: SVGSVGElement, fileName: string) => {
  const url = URL.createObjectURL(
    new Blob([getPetSvgMarkup(svg, { animated: false })], {
      type: "image/svg+xml",
    }),
  );

  try {
    const image = new Image();
    image.src = url;
    await image.decode();

    const canvas = document.createElement("canvas");
    canvas.width = PNG_WIDTH;
    canvas.height = Math.round(
      (PNG_WIDTH * EXPORT_BOX.height) / EXPORT_BOX.width,
    );
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D context is not available");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>(resolve => {
      canvas.toBlob(resolve, "image/png");
    });
    if (!blob) throw new Error("PNG encoding failed");

    saveBlob(blob, `${fileName}.png`);
  } finally {
    URL.revokeObjectURL(url);
  }
};
