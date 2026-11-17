import { getImageProps, type ImageProps } from "next/image";
import { preload } from "react-dom";

// Keep Next's responsive optimizer without hydrating a client image component.
export function OptimizedImage({ preload: eager, ...input }: ImageProps) {
  const { props } = getImageProps({
    ...input,
    ...(eager ? { loading: "eager", fetchPriority: "high" } : {}),
  });
  if (eager)
    preload(props.src, {
      as: "image",
      imageSrcSet: props.srcSet,
      imageSizes: props.sizes,
      fetchPriority: "high",
    });
  // eslint-disable-next-line @next/next/no-img-element -- Props come from Next's image optimizer.
  return <img {...props} alt={props.alt} />;
}
