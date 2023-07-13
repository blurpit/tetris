import { Vec2 } from "./main";

type TetrisConfig = {
    // Matrix properties
    matrixWidth: number,
    matrixHeight: number,

    // Game rules
    lockDownTimerMs: number,
    lockDownInfPlacement: boolean,
    lockDownExtPlacementMoves: number,
    linesPerLevel: number,
    maxLevel: number,
    softDropSpeedFactor: number,
}

export enum Facing {
    North,
    East,
    South,
    West
}

export enum Rotation {
    CW,
    CCW
}

export enum TetriminoShape {
    O, I, T, L, J, S, Z, // Normal tetrimino shapes
    Gray, Ghost          // Fake tetrimino "shapes"
}

export class Tetris {
    public cfg: TetrisConfig;
    public matrix: (TetriminoShape | null)[][];

    public tetrimino: Tetrimino;
    public nextTetrimino: Tetrimino;
    public linesCleared: number;
    public level: number;

    private genBag: Tetrimino[];
    private bagIndex: number;

    constructor(config: TetrisConfig) {
        this.cfg = config;

        // Create collision matrix (double height to include the buffer)
        this.matrix = [];
        for (let y = 0; y < config.matrixHeight * 2; y++) {
            let row = [];
            for (let x = 0; x < config.matrixWidth; x++) {
                row.push(null);
            }
            this.matrix.push(row);
        }

        this.genBag = [
            new Tetrimino(this, TetriminoShape.O),
            new Tetrimino(this, TetriminoShape.I),
            new Tetrimino(this, TetriminoShape.T),
            new Tetrimino(this, TetriminoShape.L),
            new Tetrimino(this, TetriminoShape.J),
            new Tetrimino(this, TetriminoShape.S),
            new Tetrimino(this, TetriminoShape.Z),
        ];
        this.bagIndex = 0;
        this.shuffleBag();

        this.tetrimino = this.getNextTetrimino();
        this.nextTetrimino = this.getNextTetrimino();
        this.linesCleared = 0;
        this.level = 1;

        this.spawnTetrimino();
    }

    public spawnTetrimino() {
        // Todo: figure out placement for non-standard matrix size
        this.tetrimino.setCenterPos(4, 20);
        this.tetrimino.resetRotation();
    }

    public moveDown(): boolean {
        if (this.checkCollision(this.tetrimino.x, this.tetrimino.y-1, this.tetrimino.minos)) {
            return true;
        } else if (this.checkCollision(this.tetrimino.x, this.tetrimino.y-2, this.tetrimino.minos)) {
            this.tetrimino.y--;
            return true;
        } else {
            this.tetrimino.y--;
            return false;
        }
    }

    public moveX(dx: number): boolean {
        let x = Math.max(0, Math.min(this.tetrimino.x + dx, this.cfg.matrixWidth-1));
        if (!this.checkCollision(x, this.tetrimino.y, this.tetrimino.minos)) {
            this.tetrimino.x = x;
            return true;
        }
        return false;
    }

    public rotate(dir: Rotation): boolean {
        return this.tetrimino.rotate(dir);
    }

    public getFullLines(): number[] {
        let lines = [];
        for (let y = this.cfg.matrixHeight-1; y >= 0; y--) {
            let full = true;
            for (let x = 0; x < this.cfg.matrixWidth; x++) {
                if (this.matrix[y][x] === null) {
                    full = false;
                    break;
                }
            }
            if (full) {
                lines.push(y);
            }
        }
        return lines;
    }

    public clearLine(y: number) {
        let lineY = y;
        let width = this.cfg.matrixWidth;
        let height = this.cfg.matrixHeight;

        for (let y = lineY; y < height; y++) {
            for (let x = 0; x < width; x++) {
                this.matrix[y][x] = this.matrix[y+1][x];
            }
        }

        this.linesCleared++;
        this.level = 1 + Math.floor(this.linesCleared / this.cfg.linesPerLevel);
        this.level = Math.min(this.level, this.cfg.maxLevel);
    }

    public checkCollision(centerX: number, centerY: number, minos: Vec2[]): boolean {
        let width = this.cfg.matrixWidth;

        for (let mino of minos) {
            let x = centerX + mino[0];
            let y = centerY + mino[1];

            if (x < 0 || x >= width || y < 0 || this.matrix[y][x] !== null) {
                return true;
            }
        }

        return false;
    }

    public getGhostTetriminoY() {
        let y = this.tetrimino.y;
        do {
            y--;
        } while (!this.checkCollision(this.tetrimino.x, y, this.tetrimino.minos));
        return y + 1;
    }

    public hardDrop() {
        this.tetrimino.y = this.getGhostTetriminoY();
    }

    public lockDown() {
        let x = this.tetrimino.x;
        let y = this.tetrimino.y;
        let shape = this.tetrimino.shape;

        for (let mino of this.tetrimino.minos) {
            this.matrix[y + mino[1]][x + mino[0]] = shape;
        }

        this.tetrimino = this.nextTetrimino;
        this.nextTetrimino = this.getNextTetrimino();
        this.spawnTetrimino();
    }

    public reset() {
        for (let y = 0; y < this.cfg.matrixHeight * 2; y++) {
            for (let x = 0; x < this.cfg.matrixWidth; x++) {
                this.matrix[y][x] = null;
            }
        }
        this.shuffleBag();
        this.tetrimino = this.getNextTetrimino();
        this.nextTetrimino = this.getNextTetrimino();
        this.linesCleared = 0;
        this.level = 1;
        this.spawnTetrimino();
    }

    private getNextTetrimino(): Tetrimino {
        if (this.bagIndex >= this.genBag.length) {
            this.shuffleBag();
        }
        return this.genBag[this.bagIndex++];
    }

    private shuffleBag() {
        for (let i = this.genBag.length - 1; i > 0; i--) {
            let j = Math.floor(Math.random() * (i + 1));
            let tmp = this.genBag[i];
            this.genBag[i] = this.genBag[j];
            this.genBag[j] = tmp;
        }
        this.bagIndex = 0;
    }
}

export class Tetrimino {
    private game: Tetris;
    public shape: TetriminoShape;
    public initMinos: Vec2[];
    public minos: Vec2[];
    public center: Vec2;
    public facing: Facing;

    constructor(game: Tetris, shape: TetriminoShape) {
        this.game = game;
        this.shape = shape;
        this.initMinos = Minos[shape];
        this.minos = this.copyMinos(this.initMinos);
        this.facing = Facing.North;
        this.center = [0, 0];
    }

    public setCenterPos(x: number, y: number) {
        this.center[0] = x;
        this.center[1] = y;
    }

    public get x() {
        return this.center[0];
    }

    public get y() {
        return this.center[1];
    }

    public set x(newX: number) {
        this.center[0] = newX;
    }

    public set y(newY: number) {
        this.center[1] = newY;
    }

    public resetRotation() {
        this.facing = Facing.North;
        for (let i = 0; i < this.initMinos.length; i++) {
            this.minos[i][0] = this.initMinos[i][0]; // x
            this.minos[i][1] = this.initMinos[i][1]; // y
        }
    }

    public rotate(dir: Rotation): boolean {
        let oldFacing = this.facing;
        if (dir === Rotation.CW) {
            this.rotateMinosCW();
        } else {
            this.rotateMinosCCW();
        }

        if (!this.testSRSOffsets(oldFacing, this.facing)) {
            // Undo rotation
            if (dir === Rotation.CW) {
                this.rotateMinosCCW();
            } else {
                this.rotateMinosCW();
            }
            return false;
        }

        return true;
    } 

    private rotateMinosCW() {
        let facing = this.facing;
        let newFacing = (facing + 1) % 4;

        // (x, y) -> (y, -x)
        for (let mino of this.minos) {
            let x = mino[0];
            mino[0] = mino[1];
            mino[1] = -x;
        }

        this.facing = newFacing;
    }

    private rotateMinosCCW() {
        let facing = this.facing;
        let newFacing = (facing + 3) % 4;

        // (x, y) -> (-y, x)
        for (let mino of this.minos) {
            let x = mino[0];
            mino[0] = -mino[1];
            mino[1] = x;
        }

        this.facing = newFacing;
    }

    private testSRSOffsets(oldFacing: Facing, newFacing: Facing): boolean {
        let offsetData = Offsets[this.shape];

        for (let testOffsets of offsetData) {
            // From - To
            let offsetFrom = testOffsets[oldFacing];
            let offsetTo = testOffsets[newFacing];

            let offsetX = offsetFrom[0] - offsetTo[0];
            let offsetY = offsetFrom[1] - offsetTo[1];

            let collided = this.game.checkCollision(
                this.x + offsetX, this.y + offsetY, 
                this.minos
            );

            if (!collided) {
                this.x += offsetX;
                this.y += offsetY;
                return true;
            }
        }

        return false;
    }

    private copyMinos(initMinos: Vec2[]): Vec2[] {
        let minos: Vec2[] = [];
        for (let i = 0; i < initMinos.length; i++) {
            let mino = initMinos[i];
            minos[i] = [mino[0], mino[1]];
        }
        return minos;
    }
}

const Minos: Vec2[][] = [
    // O
    [[0, 0], [1, 0], [0, 1], [1, 1]],

    // I
    [[-1, 0], [0, 0], [1, 0], [2, 0]],

    // T
    [[-1, 0], [0, 0], [1, 0], [0, 1]],

    // L
    [[-1, 0], [0, 0], [1, 0], [1, 1]],

    // J
    [[-1, 1], [-1, 0], [0, 0], [1, 0]],

    // S
    [[-1, 0], [0, 0], [0, 1], [1, 1]],

    // Z
    [[-1, 1], [0, 1], [0, 0], [1, 0]]
]

const OffsetsTLJSZ: Vec2[][] = [
    // Point 1
    [[0, 0], [0, 0], [0, 0], [0, 0]],
    
    // Point 2
    [[0, 0], [1, 0], [0, 0], [-1, 0]],

    // Point 3
    [[0, 0], [1, -1], [0, 0], [-1, -1]],

    // Point 4
    [[0, 0], [0, 2], [0, 0], [0, 2]],

    // Point 5
    [[0, 0], [1, 2], [0, 0], [1, 2]]
]

const OffsetsI: Vec2[][] = [
    // Point 1
    [[0, 0], [-1, 0], [-1, 1], [0, 1]],

    // Point 2
    [[-1, 0], [0, 0], [1, 1], [0, 1]],

    // Point 3
    [[2, 0], [0, 0], [-2, 1], [0, 1]],

    // Point 4
    [[-1, 0], [0, 1], [1, 0], [0, -1]],

    // Point 5
    [[2, 0], [0, -2], [-2, 0], [0, 2]]
]

const OffsetsO: Vec2[][] = [
    // Point 1
    [[0, 0], [0, -1], [-1, -1], [-1, 0]]
]

const Offsets = [
    OffsetsO,     // O
    OffsetsI,     // I
    OffsetsTLJSZ, // T
    OffsetsTLJSZ, // L
    OffsetsTLJSZ, // J
    OffsetsTLJSZ, // S
    OffsetsTLJSZ, // Z
]
