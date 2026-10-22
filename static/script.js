const TOTAL_LEVELS = 20;

const homeScreen = document.getElementById("home-screen");
const splashScreen = document.getElementById("splash-screen");
const levelScreen = document.getElementById("level-screen");
const gameScreen = document.getElementById("game-screen");

const levelsContainer = document.getElementById("levels");
const keyboard = document.getElementById("keyboard");
const wordElement = document.getElementById("word");
const guessesElement = document.getElementById("guesses");
const messageElement = document.getElementById("message");
const timerElement = document.getElementById("timer");
const levelTitle = document.getElementById("level-title");
const pauseOverlay = document.getElementById("pause-overlay");
const overlayTitle = document.getElementById("overlay-title");
const countdownElement = document.getElementById("countdown");
const nextLevelButton = document.getElementById("next-level-button");

let currentMode = "basic";
let currentLevel = 1;
let wordsFound = 0;
let wordsRequired = 3;
let secondsLeft = 0;
let timerId = null;
let countdownId = null;
let transitionId = null;
let gameFinished = false;
let unlockedLevel = 1;

function storageKey(mode) {
    return `hangmanUnlocked-${mode}`;
}

function timeForLevel(mode, level) {
    if (mode === "hard") return Math.max(12, 30 - level);
    if (mode === "medium") return Math.max(18, 45 - level);
    return Math.max(25, 60 - level);
}

function showHome() {
    clearInterval(timerId);
    clearInterval(countdownId);
    clearTimeout(transitionId);

    timerId = null;
    countdownId = null;
    transitionId = null;

    gameScreen.hidden = true;
    levelScreen.hidden = true;
    splashScreen.hidden = true;
    homeScreen.hidden = false;
}

function showLevelSelect() {
    clearInterval(timerId);
    clearInterval(countdownId);
    clearTimeout(transitionId);

    timerId = null;
    countdownId = null;
    transitionId = null;

    gameScreen.hidden = true;
    homeScreen.hidden = true;
    splashScreen.hidden = true;
    levelScreen.hidden = false;

    unlockedLevel = Number(localStorage.getItem(storageKey(currentMode))) || 1;
    document.getElementById("mode-title").textContent =
        `${currentMode[0].toUpperCase()}${currentMode.slice(1)} Levels`;

    drawLevels();
}

function drawLevels() {
    levelsContainer.innerHTML = "";

    for (let level = 1; level <= TOTAL_LEVELS; level++) {
        const button = document.createElement("button");
        const locked = level > unlockedLevel;

        button.className = locked ? "level-button locked" : "level-button";
        button.disabled = locked;
        button.innerHTML = locked
            ? `🔒 Level ${level}<span>Find ${level + 2} words</span>`
            : `▶ Level ${level}<span>Find ${level + 2} words</span>`;

        if (!locked) {
            button.addEventListener("click", () => startLevel(level));
        }

        levelsContainer.appendChild(button);
    }
}

async function startLevel(level) {
    clearInterval(timerId);
    clearInterval(countdownId);
    clearTimeout(transitionId);

    timerId = null;
    countdownId = null;
    transitionId = null;
    gameFinished = false;
    currentLevel = level;

    nextLevelButton.hidden = true;
    pauseOverlay.hidden = true;

    try {
        const response = await fetch("/start-level", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                level: level,
                mode: currentMode
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Could not start the level.");
        }

        wordsFound = result.words_found;
        wordsRequired = result.words_required;

        splashScreen.hidden = true;
        homeScreen.hidden = true;
        levelScreen.hidden = true;
        gameScreen.hidden = false;

        levelTitle.textContent =
            `${currentMode[0].toUpperCase()}${currentMode.slice(1)} · Level ${level}`;

        wordElement.textContent = Array(result.word_length).fill("_").join(" ");
        guessesElement.textContent =
            `Words: ${wordsFound} / ${wordsRequired} · Wrong guesses: 0 / 6`;
        messageElement.textContent = "Find the hidden word!";
        timerElement.classList.remove("low-time");

        drawHangman(0);
        makeKeyboard();
        startTimer(timeForLevel(currentMode, level));
    } catch (error) {
        alert(error.message);
    }
}

function makeKeyboard() {
    keyboard.innerHTML = "";

    for (const letter of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
        const button = document.createElement("button");
        button.textContent = letter;
        button.className = "key";
        button.addEventListener("click", () => sendGuess(letter, button));
        keyboard.appendChild(button);
    }
}

async function sendGuess(letter, button) {
    if (gameFinished || timerId === null) {
        return;
    }

    button.disabled = true;

    try {
        const response = await fetch("/guess", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                letter: letter,
                mode: currentMode
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Could not check that letter.");
        }

        const isCorrect = result.word_display.includes(letter);
        button.classList.add(isCorrect ? "correct" : "wrong");

        wordElement.textContent = result.word_display.join(" ");
        guessesElement.textContent =
            `Words: ${result.words_found} / ${result.words_required}` +
            ` · Wrong guesses: ${result.wrong_guesses} / 6`;

        drawHangman(result.wrong_guesses);

        // Trust the completed word count as a fallback as well as the API flag.
        // This ensures the next-level action appears as soon as the target is reached.
        const levelComplete = result.level_complete === true ||
            Number(result.words_found) >= Number(result.words_required);

        if (levelComplete) {
            wordsFound = result.words_found;
            finishGame();
            messageElement.textContent =
                `Level ${currentLevel} complete! Great job! 🎉`;
            unlockNextLevel();
        } else if (result.lost) {
            finishGame();
            messageElement.textContent =
                `Word missed! The answer was ${result.answer}. Restart this level to try again.`;
        } else if (result.won) {
            wordsFound = result.words_found;
            clearInterval(timerId);
            timerId = null;
            disableKeyboard();

            messageElement.textContent =
                `Word found! ${result.words_found} of ${result.words_required}.`;

            transitionId = setTimeout(() => {
                wordElement.textContent =
                    Array(result.next_word_length).fill("_").join(" ");
                guessesElement.textContent =
                    `Words: ${wordsFound} / ${wordsRequired} · Wrong guesses: 0 / 6`;
                messageElement.textContent = "Find the next word!";
                drawHangman(0);
                makeKeyboard();
                startTimer(timeForLevel(currentMode, currentLevel));
                transitionId = null;
            }, 1000);
        } else if (!isCorrect) {
            messageElement.textContent = "Not in the word. Try again!";
        } else {
            messageElement.textContent = "Good guess! Keep going!";
        }
    } catch (error) {
        messageElement.textContent = error.message;
        button.disabled = false;
    }
}

function drawHangman(wrongGuesses) {
    const parts = [
        "head",
        "body",
        "arm-left",
        "arm-right",
        "leg-left",
        "leg-right"
    ];

    parts.forEach((part, index) => {
        document.querySelector(`.${part}`).style.display =
            index < wrongGuesses ? "block" : "none";
    });
}

function disableKeyboard() {
    document.querySelectorAll(".key").forEach(button => {
        button.disabled = true;
    });
}

function startTimer(seconds) {
    clearInterval(timerId);
    secondsLeft = seconds;
    updateTimerDisplay();

    timerId = setInterval(() => {
        secondsLeft--;
        updateTimerDisplay();

        if (secondsLeft <= 0) {
            finishGame();
            messageElement.textContent =
                "Time is up! Restart this level to try again.";
        }
    }, 1000);
}

function updateTimerDisplay() {
    timerElement.textContent = `⏱ ${secondsLeft}`;
    timerElement.classList.toggle("low-time", secondsLeft <= 10);
}

function finishGame() {
    gameFinished = true;
    clearInterval(timerId);
    timerId = null;
    disableKeyboard();
}

function unlockNextLevel() {
    if (currentLevel < TOTAL_LEVELS) {
        unlockedLevel = Math.max(unlockedLevel, currentLevel + 1);
        localStorage.setItem(storageKey(currentMode), unlockedLevel);
        nextLevelButton.textContent = `Next Level ${currentLevel + 1} →`;
        nextLevelButton.hidden = false;
    } else {
        messageElement.textContent =
            `Amazing! You completed all ${TOTAL_LEVELS} ${currentMode} levels! 🏆`;
    }
}

document.getElementById("enter-app-button").addEventListener("click", showHome);

document.querySelectorAll(".difficulty-card").forEach(button => {
    button.addEventListener("click", () => {
        currentMode = button.dataset.mode;
        showLevelSelect();
    });
});

document.getElementById("back-to-difficulty").addEventListener("click", showHome);

document.getElementById("home-button").addEventListener("click", showLevelSelect);

document.getElementById("previous-button").addEventListener("click", () => {
    if (currentLevel > 1) {
        startLevel(currentLevel - 1);
    } else {
        showLevelSelect();
    }
});

document.getElementById("restart-button").addEventListener("click", () => {
    startLevel(currentLevel);
});

nextLevelButton.addEventListener("click", () => {
    if (currentLevel < TOTAL_LEVELS) {
        startLevel(currentLevel + 1);
    }
});

document.getElementById("pause-button").addEventListener("click", () => {
    if (gameFinished || timerId === null) {
        return;
    }

    clearInterval(timerId);
    timerId = null;

    pauseOverlay.hidden = false;
    overlayTitle.textContent = "Game Paused";
    countdownElement.textContent = "Your time is paused.";
});

document.getElementById("resume-button").addEventListener("click", () => {
    let count = 3;
    overlayTitle.textContent = "Get ready!";
    countdownElement.textContent = count;

    clearInterval(countdownId);

    countdownId = setInterval(() => {
        count--;

        if (count > 0) {
            countdownElement.textContent = count;
        } else {
            clearInterval(countdownId);
            countdownId = null;
            pauseOverlay.hidden = true;
            startTimer(secondsLeft);
        }
    }, 1000);
});

// App khulte hi logo screen dikhao
splashScreen.hidden = false;
homeScreen.hidden = true;
levelScreen.hidden = true;
gameScreen.hidden = true;
