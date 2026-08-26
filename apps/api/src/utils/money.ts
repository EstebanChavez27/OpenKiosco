export const EPS = 1e-9

export const r2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100

export const moneyEq = (a: number, b: number): boolean => Math.abs(a - b) < 0.01
