export function parse(text) {
    const lines = text.split('\n');

    const parseBlock = prefix => lines
        .filter(line => line.startsWith(prefix))
        .map(line => line.slice(prefix.length).trim().split(/\s+/));

    const triangulate = list => list.slice(2).flatMap((_, i) => [list[0], list[i + 1], list[i + 2]]);

    const positions = parseBlock('v ').map(line => line.map(Number));
    const texcoords = parseBlock('vt ').map(line => line.map(Number));
    const normals = parseBlock('vn ').map(line => line.map(Number));
    const faces = parseBlock('f ').map(line => line.map(face => face.split('/').map(Number))).flatMap(triangulate);

    const vertices = [];
    const indices = [];
    const idToIndex = {};

    for (const face of faces) {
        const id = face.join('/');
        if (id in idToIndex) {
            indices.push(idToIndex[id]);
        } else {
            idToIndex[id] = vertices.length;
            indices.push(vertices.length);
            vertices.push({
                position: positions[face[0] - 1],
                texcoords: texcoords[face[1] - 1],
                normal: normals[face[2] - 1],
            });
        }
    }

    return { vertices, indices };
}
