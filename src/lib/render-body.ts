import { cleanBody } from "./content-validation";
import { parseDocument, DomUtils } from "htmlparser2";
import { imageUrl } from "./image-url";
export function optimizeBodyImages(html: string) {
  const document = parseDocument(cleanBody(html));
  for (const image of DomUtils.getElementsByTagName(
    "img",
    document.children,
    true,
  )) {
    const source = image.attribs.src;
    const width = Number(image.attribs.width),
      height = Number(image.attribs.height);
    if (
      !/^\/api\/media\/[a-f0-9-]+\.webp$/.test(source ?? "") ||
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      width < 1 ||
      height < 1
    ) {
      image.name = "span";
      image.attribs = {};
      continue;
    }
    const url = imageUrl(source);
    image.attribs = {
      ...image.attribs,
      src: `/_next/image?url=${encodeURIComponent(url)}&w=1080&q=75`,
      srcset: [640, 1080, 1920]
        .map(
          (size) =>
            `/_next/image?url=${encodeURIComponent(url)}&w=${size}&q=75 ${size}w`,
        )
        .join(", "),
      sizes: "(max-width: 800px) 90vw, 760px",
      loading: "lazy",
      decoding: "async",
    };
  }
  return DomUtils.getInnerHTML(document);
}
export function splitBodyForAds(html: string) {
  const nodes = parseDocument(cleanBody(html)).children;
  const paragraph = nodes.findIndex(
    (node) => node.type === "tag" && node.name === "p",
  );
  const firstEnd = paragraph >= 0 ? paragraph + 1 : Math.min(1, nodes.length);
  const rest = nodes.slice(firstEnd);
  const mid = Math.ceil(rest.length / 2);
  const render = (items: typeof nodes) =>
    items.map((node) => DomUtils.getOuterHTML(node)).join("");
  return {
    first: render(nodes.slice(0, firstEnd)),
    rest: render(rest),
    beforeMiddle: render(rest.slice(0, mid)),
    afterMiddle: render(rest.slice(mid)),
  };
}
