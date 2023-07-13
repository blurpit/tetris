import { Rotation, TetriminoShape, Tetris } from "./game";
import { Graphics } from "./graphics";

export type Vec2 = [number, number];

/** 
 * Basic Tetris controller class. Contains one game and one graphics, and provides
 * methods for interacting with the game.
 */
class Controller {
    protected game: Tetris;
    protected graphics: Graphics;
    
    constructor() {
        this.game = new Tetris({
            matrixWidth: 10,
            matrixHeight: 20,

            lockDownTimerMs: 500,
            lockDownInfPlacement: false,
            lockDownExtPlacementMoves: 15,
            linesPerLevel: 10,
            maxLevel: 15,
            softDropSpeedFactor: 20,
        });

        this.graphics = new Graphics({
            canvas: document.getElementById("game-canvas") as HTMLCanvasElement,
            matrixWidth: this.game.cfg.matrixWidth,
            matrixHeight: this.game.cfg.matrixHeight,
            nextPreviewSize: 5,

            showGhost: true,
            bgColor: "#eee",
            matrixBgColor: "#fff",
            matrixStrokeColor: "#000",
            gridColor: "#999",
            matrixPadding: 20,
            blockStrokeWidth: 2,
            fontFamily: "Robot_Font",
            fontSize: 40,
            bigFontSize: 50,
            textPadding: 8,
        });
    }

    /**
     * Update the following in the graphics:
     * - Blocks
     * - Tetrimino in play
     * - Ghost Tetrimino
     * - Next Tetrimino
     * 
     * and draw the frame to the canvas.
     */
    protected drawGraphics() {
        let width = this.game.cfg.matrixWidth;
        let height = this.game.cfg.matrixHeight;

        // Set locked down blocks in graphics
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let shape = this.game.matrix[y][x];
                if (shape === null) {
                    this.graphics.clearBlock(x, y);
                } else {
                    this.graphics.setBlock(x, y, shape);
                }
            }
        }

        // Draw tetrimino & ghost tetrimino
        let tet = this.game.tetrimino;
        if (this.graphics.cfg.showGhost) {
            this.graphics.setTetrimino(
                tet.x, this.game.getGhostTetriminoY(), 
                tet.minos, TetriminoShape.Ghost
            );
        }
        this.graphics.setTetrimino(
            tet.x, tet.y, 
            tet.minos, tet.shape
        );

        // Draw next tetrimino
        this.graphics.setNextTetrimino(
            this.game.nextTetrimino.minos,
            this.game.nextTetrimino.shape
        );

        this.graphics.draw();
    }

    /**
     * Clear all full lines, updates the score & level in the graphics.
     */
    protected clearFullLines() {
        this.game.getFullLines().forEach((y) => {
            this.game.clearLine(y);
            this.graphics.clearLine(y);
        });
        this.graphics.setScore(this.game.linesCleared);
        this.graphics.setLevel(this.game.level);
    }

    /** Move the Tetrimino in play down one space and draw graphics */
    public moveDown() {
        if (this.game.moveDown()) {
            this.game.lockDown();
            this.clearFullLines();
        }
        this.drawGraphics();
    }

    /** 
     * Move the Tetrimino in play left one space and draw graphics
     * @returns true if the Tetrimino moved, false if it was blocked
     */
    public moveLeft(): boolean {
        let moved = this.game.moveX(-1);
        this.drawGraphics();
        return moved;
    }

    /**
     * Move the Tetrimino in play right one space and draw graphics
     * @returns true if the Tetrimino moved, false if it was blocked
     */
    public moveRight(): boolean {
        let moved = this.game.moveX(1);
        this.drawGraphics();
        return moved;
    }
    
    /**
     * Rotate the Tetrimino in play
     * @param dir Direction to rotate
     * @returns true if the tetrimino rotated, false if it was blocked
     */
    public rotate(dir: Rotation): boolean {
        let rotated = this.game.rotate(dir);
        this.drawGraphics();
        return rotated;
    }
    
    /** Soft Drop not implemented for base controller */
    public softDrop() {
        // Basic controller doesn't soft drop, so treat
        // soft dropping the same as falling.
        this.moveDown();
    }

    /** Drop the Tetrimino in play until it lands on a Surface, immediately Lock Down, and draw graphics. */
    public hardDrop() {
        this.game.hardDrop();
        this.drawGraphics();
    }

    /** Reset the game */
    public reset() {
        this.game.reset();
        this.graphics.reset();
    }
}

/**
 * Controller class for a human player. Implements a falling loop, lockdown timer, soft drop,
 * falling speed, and keyboard input.
 */
class HumanController extends Controller {
    private fallTimer: NodeJS.Timeout | null;
    private lockDownTimer: NodeJS.Timeout | null;
    private lockDownMoveCount: number;
    private isSoftDropping: boolean;

    constructor() {
        super();
        this.addEventListeners();

        this.fallTimer = null;
        this.lockDownTimer = null;
        this.lockDownMoveCount = 0;
        this.isSoftDropping = false;
    }

    /** Run the game by starting the falling loop */
    public start() {
        this.startFallLoop();
        this.drawGraphics();
    }

    public moveDown() {
        if (this.game.moveDown()) {
            this.interruptFallLoop();
            this.startLockDownTimer();
        }

        // Draw graphics
        this.drawGraphics();
    }

    /** Soft Drop the Tetrimino in play, increasing the falling speed by `softDropSpeedFactor` in the game config */
    public softDrop() {
        if (!this.isSoftDropping) {
            this.isSoftDropping = true;
            this.interruptFallLoop();
            this.startFallLoop();
            this.moveDown(); // lock down instantly
        }
    }

    /** End Soft Drop, returning to normal falling speed */
    public endSoftDrop() {
        if (this.isSoftDropping) {
            this.isSoftDropping = false;
            this.interruptFallLoop();
            this.startFallLoop();
        }
    }

    public hardDrop() {
        this.interruptLockDownTimer();
        this.game.hardDrop();
        this.lockDown();
        this.drawGraphics();
    }

    public reset() {
        super.reset();
        this.interruptFallLoop();
        this.interruptLockDownTimer();
    }

    protected clearFullLines() {
        let levelBefore = this.game.level;
        super.clearFullLines();

        if (this.game.level !== levelBefore) {
            this.interruptFallLoop();
            this.startFallLoop();
        }
    }

    /**
     * Get the Tetrimino in play falling speed
     * @returns Time in milliseconds for the Tetrimino in play to fall 1 space
     */
    private getFallSpeed(): number {
        let speed = Math.pow(0.8 - (this.game.level - 1) * 0.007, this.game.level - 1) * 1000;
        if (this.isSoftDropping) {
            return speed / this.game.cfg.softDropSpeedFactor;
        }
        return speed;
    }

    /** Start a timer that runs `this.moveDown()` periodically depending on the current falling speed */
    private startFallLoop() {
        this.interruptFallLoop();
        this.fallTimer = setInterval(this.moveDown.bind(this), this.getFallSpeed());
    }

    /** Cancel the falling loop */
    private interruptFallLoop() {
        if (this.fallTimer !== null) {
            clearInterval(this.fallTimer);
            this.fallTimer = null;
        }
    }

    /** Start the Lock Down Timer, runs `this.lockDown()` */
    private startLockDownTimer() {
        this.interruptLockDownTimer();
        this.lockDownTimer = setTimeout(this.lockDown.bind(this), this.game.cfg.lockDownTimerMs);
    }

    /** Cancel the Lock Down Timer */
    private interruptLockDownTimer() {
        if (this.lockDownTimer !== null) {
            clearTimeout(this.lockDownTimer);
            this.lockDownTimer = null;
        }
    }

    /** Lock Down the Tetrimino in play and draw graphics */
    private lockDown() {
        this.lockDownTimer = null;
        this.game.lockDown();
        this.clearFullLines();
        this.startFallLoop();
        this.drawGraphics();
    }

    /** Register event listeners for keyboard controls */
    private addEventListeners() {
        addEventListener("keydown", (e) => {
            let moved = false;

            switch (e.key) {
                case "ArrowLeft":
                    moved = this.moveLeft();
                    break;
                case "ArrowRight":
                    moved = this.moveRight();
                    break;
                case "ArrowUp":
                    moved = this.rotate(Rotation.CW);
                    break;
                case "x":
                    moved = this.rotate(Rotation.CW);
                    break;
                case "z":
                    moved = this.rotate(Rotation.CCW);
                    break;
                case "ArrowDown":
                    this.softDrop();
                    break;
                case " ":
                    this.hardDrop();
                    break;
                case "r":
                    this.reset();
                    this.start();
                    break;
            }

            // Reset lock down timer if the piece was moved
            // Todo: implement lockDownMoveCount
            if (moved && this.lockDownTimer !== null) {
                this.interruptLockDownTimer();
                this.startFallLoop();
            }
        });

        addEventListener("keyup", (e) => {
            switch (e.key) {
                case "ArrowDown":
                    this.endSoftDrop();
                    break;
            }
        });
    }
}

new HumanController().start();