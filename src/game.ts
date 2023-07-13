import { Vec2 } from "./main";

/** Game config */
type TetrisConfig = {
    // Matrix properties
    /** Width of the Matrix in blocks (official: 10) */
    matrixWidth: number,
    /** Height of the Matrix in blocks (official: 20) */
    matrixHeight: number,

    // Game rules
    /** Time in milliseconds for a Tetrimino to Lock Down after landing on a Surface (official: 500) */
    lockDownTimerMs: number,
    /** Set true to enable Infinite Placement Lock Down [Todo] */
    lockDownInfPlacement: boolean,
    /** Max number of moves/rotates for Extended Placement Lock Down. Set to 0 to enable Classic Lock Down. (official: 15) [Todo] */
    lockDownExtPlacementMoves: number,
    /** Number of lines to clear to increase the level (official: 10) */
    linesPerLevel: number,
    /** Maximum level, determines falling speed (official: 15) */
    maxLevel: number,
    /** Factor by which falling speed increases while Soft Dropping (official: 20) */
    softDropSpeedFactor: number,
}

/** Tetrimino orientations */
export enum Facing {
    North,
    East,
    South,
    West
}

/** Tetrimino rotation directions */
export enum Rotation {
    CW,
    CCW
}

/** Tetrimino shapes */
export enum TetriminoShape {
    O, I, T, L, J, S, Z, // Normal tetrimino shapes
    Gray, Ghost          // Fake tetrimino "shapes"
}

/** Tetris game class */
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

    /** Place the Tetrimino in play at its spawn location above the Skyline */
    public spawnTetrimino() {
        // Todo: figure out placement for non-standard matrix size
        this.tetrimino.setCenterPos(4, 20);
        this.tetrimino.resetRotation();
    }

    /** 
     * Move the Tetrimino in play down 1 space.
     * @returns true if the Tetrimino landed on a Surface
     */
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

    /**
     * Move the Tetrimino in play in the x direction
     * @param dx Number of spaces to move
     * @returns true if the Tetrimino was able to move
     */
    public moveX(dx: number): boolean {
        let x = Math.max(0, Math.min(this.tetrimino.x + dx, this.cfg.matrixWidth-1));
        if (!this.checkCollision(x, this.tetrimino.y, this.tetrimino.minos)) {
            this.tetrimino.x = x;
            return true;
        }
        return false;
    }

    /**
     * Rotate the Tetrimino in play in a given direction
     * @param dir Direction to rotate in
     * @returns true if the Tetrimino was able to rotate
     */
    public rotate(dir: Rotation): boolean {
        return this.tetrimino.rotate(dir);
    }

    /**
     * Gets the y position of every filled line in the Matrix
     * @returns Array of y positions of full lines
     */
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

    /**
     * Clears a line in the Matrix, moving down all lines above and increasing the score
     * @param y y position of the line to clear
     */
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

    /**
     * Tests collision of a given Tetrimino with the Matrix
     * @param centerX x position of the Tetrimino
     * @param centerY y position of the Tetrimino
     * @param minos Array of positions of each Mino in the Tetrimino, relative to the center Mino
     * @returns true if any Mino overlapped with a Block in the Matrix
     */
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

    /**
     * Get the y position of the Ghost Piece
     * @returns y position of the Ghost Piece
     */
    public getGhostTetriminoY(): number {
        let y = this.tetrimino.y;
        do {
            y--;
        } while (!this.checkCollision(this.tetrimino.x, y, this.tetrimino.minos));
        return y + 1;
    }

    /** Hard Drop the Tetrimino in play, instantly moving it down until it lands on a Surface */
    public hardDrop() {
        this.tetrimino.y = this.getGhostTetriminoY();
    }

    /** Lock Down the Tetrimino in play. Place it into the Matrix, and generate the next Tetrimino. */
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

    /** Reset the game */
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

    /**
     * Fetch the next random Tetrimino from the bag
     * @returns Tetrimino object
     */
    private getNextTetrimino(): Tetrimino {
        if (this.bagIndex >= this.genBag.length) {
            this.shuffleBag();
        }
        return this.genBag[this.bagIndex++];
    }

    /** Shuffle the Tetrimino bag */
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

/** Class representing a Tetrimino */
export class Tetrimino {
    /** Tetris game reference */
    private game: Tetris;
    /** Shape of the Tetrimino */
    public shape: TetriminoShape;
    /** Initial positions of each Mino, relative to the center Mino */
    public initMinos: Vec2[];
    /** Current positions of each Mino, relative to the center Mino (may be rotated) */
    public minos: Vec2[];
    /** Position of the center Mino in the Matrix */
    public center: Vec2;
    /** Orientation of the Tetrimino */
    public facing: Facing;

    constructor(game: Tetris, shape: TetriminoShape) {
        this.game = game;
        this.shape = shape;
        this.initMinos = Minos[shape];
        this.minos = [];
        this.copyMinos();
        this.facing = Facing.North;
        this.center = [0, 0];
    }

    /**
     * Set the position of the center Mino
     * @param x x position
     * @param y y position
     */
    public setCenterPos(x: number, y: number) {
        this.center[0] = x;
        this.center[1] = y;
    }

    /** x position of the center Mino */
    public get x(): number {
        return this.center[0];
    }

    /** y position of the center Mino */
    public get y(): number {
        return this.center[1];
    }

    public set x(newX: number) {
        this.center[0] = newX;
    }

    public set y(newY: number) {
        this.center[1] = newY;
    }

    /** Reset the Tetrimino to be North facing */
    public resetRotation() {
        this.facing = Facing.North;
        for (let i = 0; i < this.initMinos.length; i++) {
            this.minos[i][0] = this.initMinos[i][0]; // x
            this.minos[i][1] = this.initMinos[i][1]; // y
        }
    }

    /** 
     * Rotate the Tetrimino
     * @param dir Direction to rotate
     * @returns true if the Tetrimino was able to rotate
     */
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

    /** Rotate each Mino 90 degrees clockwise */
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

    /** Rotate each Mino 90 degrees counterclockwise */
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

    /**
     * Performs the Super Rotation System offset tests, and moves the Tetrimino by the first successful offset
     * @param oldFacing Orientation prior to rotation
     * @param newFacing Orientation after rotation
     * @returns true if the Tetrimino is able to rotate
     */
    private testSRSOffsets(oldFacing: Facing, newFacing: Facing): boolean {
        let offsetData = SRSOffsets[this.shape];

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

    /** Copy the Mino positions from `initMinos` into `minos` */
    private copyMinos() {
        for (let i = 0; i < this.initMinos.length; i++) {
            let mino = this.initMinos[i];
            this.minos[i] = [mino[0], mino[1]];
        }
    }
}

/** Mino positions for each Tetrimino shape */
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

/** Offset values for each SRS test point for T, L, J, S, and Z Tetriminos */
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

/** Offset values for each SRS test point for the I Tetrimino */
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

/** Offset values for the SRS test point for the O Tetrimino */
const OffsetsO: Vec2[][] = [
    // Point 1
    [[0, 0], [0, -1], [-1, -1], [-1, 0]]
]

/** Mapping of `TetriminoShape` to SRS offset data */
const SRSOffsets = [
    OffsetsO,     // O
    OffsetsI,     // I
    OffsetsTLJSZ, // T
    OffsetsTLJSZ, // L
    OffsetsTLJSZ, // J
    OffsetsTLJSZ, // S
    OffsetsTLJSZ, // Z
]
