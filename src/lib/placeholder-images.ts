import data from './placeholder-images.json';

export type ImagePlaceholder = {
  id: string;
  description: string;
  imageUrl: string;
  imageHint: string;
};

// The data is checked for existence before being accessed.
export const PlaceHolderImages: ImagePlaceholder[] = data?.placeholderImages || [];
