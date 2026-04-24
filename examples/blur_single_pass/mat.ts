export function multiply2(A: number[][], B: number[][]) {
    const C = Array.from({ length: B.length }, () => Array(A[0].length).fill(0));
    for (let j = 0; j < B.length; j++) {
        for (let i = 0; i < A[0].length; i++) {
            for (let k = 0; k < A.length; k++) {
                C[j][i] += A[k][i] * B[j][k];
            }
        }
    }
    return C;
}

export function multiply(...matrices: number[][][]) {
    return matrices
        .reduce((acc, m) => multiply2(acc, m));
}

export function toF32(m: number[][]) {
    return new Float32Array(m.flat());
}

export function perspective(fovy: number, aspect: number, near: number, far: number) {
    const f = 1 / Math.tan(fovy / 2);
    return [
        [f / aspect, 0, 0, 0],
        [0, f, 0, 0],
        [0, 0, (far + near) / (near - far), -1],
        [0, 0, (2 * far * near) / (near - far), 0]
    ];
}

export function translation(x: number, y: number, z: number) {
    return [
        [1, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [x, y, z, 1],
    ];
}

export function rotation(x: number, y: number, z: number, w: number) {
    return [
        [1 - 2 * (y * y + z * z), 2 * (x * y + w * z), 2 * (x * z - w * y), 0],
        [2 * (x * y - w * z), 1 - 2 * (x * x + z * z), 2 * (y * z + w * x), 0],
        [2 * (x * z + w * y), 2 * (y * z - w * x), 1 - 2 * (x * x + y * y), 0],
        [0, 0, 0, 1],
    ];
}

export function axisAngle([x, y, z]: [number, number, number], angle: number) {
    const c = Math.cos(angle / 2);
    const s = Math.sin(angle / 2) / Math.hypot(x, y, z);
    return rotation(x * s, y * s, z * s, c);
}
