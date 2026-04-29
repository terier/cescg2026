export function text(url: string) {
    return fetch(url).then(response => response.text());
}

export function image(url: string) {
    return fetch(url).then(response => response.blob()).then(blob => createImageBitmap(blob));
}
