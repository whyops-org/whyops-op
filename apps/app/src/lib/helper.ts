export const goToDocumentation = () => {
   window.open("https://whyops.com/docs", "_blank", "noopener,noreferrer");
};

export const getPlaceHolderImage = (name: string, style: string = "notionists-neutral") => {
   return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(name)}&scale=90`;
}