export function text(url) {
    return fetch(url).then(response => response.text());
}

export function image(url) {
    return fetch(url).then(response => response.blob()).then(blob => createImageBitmap(blob));
}
