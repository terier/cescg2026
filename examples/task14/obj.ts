function parseBlock(lines: string[], prefix: string) {
    return lines
        .filter(line => line.startsWith(prefix))
        .map(line => line.slice(prefix.length).trim().split(/\s+/));
}

function triangulate(list: number[][]) {
    return list
        .slice(2)
        .flatMap((_, i) => [list[0], list[i + 1], list[i + 2]])
        .filter(item => item !== undefined);
}

export function parse(text: string) {
    const lines = text.split('\n');

    const positions = parseBlock(lines, 'v ')
        .map(line => line.map(Number));
    const texcoords = parseBlock(lines, 'vt ')
        .map(line => line.map(Number));
    const normals = parseBlock(lines, 'vn ')
        .map(line => line.map(Number));
    const faces = parseBlock(lines, 'f ')
        .map(line => line.map(face => face.split('/').map(Number)))
        .flatMap(triangulate);

    const vertices = [];
    const indices = [];
    const idToIndex: { [key: string]: number } = {};

    for (const face of faces) {
        const id = face?.join('/');
        if (id === undefined || face.length < 3) {
            continue;
        }

        if (id in idToIndex) {
            indices.push(idToIndex[id]);
        } else {
            idToIndex[id] = vertices.length;
            indices.push(vertices.length);
            vertices.push({
                position: positions[face[0]! - 1],
                texcoords: texcoords[face[1]! - 1],
                normal: normals[face[2]! - 1]
            });
        }
    }

    return { vertices, indices };
}
