from flask import Flask, render_template, jsonify, request
import random

app = Flask(__name__)

WORD_BANKS = {
    3: ["CAT", "DOG", "SUN", "MAP", "CUP", "PEN", "BUS", "FOX"],
    4: ["MOON", "STAR", "FROG", "BOOK", "FISH", "CAKE", "RAIN", "TREE"],
    5: ["APPLE", "TIGER", "HOUSE", "PLANT", "GRAPE", "BREAD", "CHAIR"],
    6: ["PYTHON", "GARDEN", "ROCKET", "PLANET", "SCHOOL", "ORANGE"],
    7: ["RAINBOW", "DOLPHIN", "LAPTOP", "COUNTRY", "JOURNEY"],
    8: ["MOUNTAIN", "NOTEBOOK", "ELEPHANT", "BUILDING"],
    9: ["BUTTERFLY", "CHOCOLATE", "ADVENTURE", "IMPORTANT"],
    10: ["PLAYGROUND", "FRIENDSHIP", "BASKETBALL", "NEWSPAPERS", "SPACECRAFT", "HELICOPTER"],
    11: ["PROGRAMMING", "CELEBRATION", "INDEPENDENT", "DEVELOPMENT", "ENVIRONMENT", "INFORMATION"],
    12: ["CONVERSATION", "EXPERIMENTAL", "COMPUTERIZED"],
}

MODES = {"basic", "medium", "hard"}
game = {}


def get_word_length(mode, level):
    if mode == "medium":
        return min(level + 4, 11)

    if mode == "hard":
        return min(level + 6, 12)

    return min(level + 2, 10)


def start_new_game(mode, level):
    word_length = get_word_length(mode, level)

    game["mode"] = mode
    game["level"] = level
    game["words_required"] = level + 2
    game["words_found"] = 0
    game["word"] = random.choice(WORD_BANKS[word_length])
    game["guessed"] = []
    game["wrong_guesses"] = 0


@app.route("/")
def home():
    start_new_game("basic", 1)
    return render_template("index.html")


@app.route("/start-level", methods=["POST"])
def start_level():
    data = request.get_json() or {}
    mode = str(data.get("mode", "basic")).lower()

    try:
        level = int(data.get("level", 1))
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid level."}), 400

    if mode not in MODES:
        return jsonify({"error": "Choose Basic, Medium, or Hard."}), 400

    if level < 1 or level > 20:
        return jsonify({"error": "Level must be between 1 and 20."}), 400

    start_new_game(mode, level)

    return jsonify({
        "mode": game["mode"],
        "level": game["level"],
        "word_length": len(game["word"]),
        "words_required": game["words_required"],
        "words_found": game["words_found"],
    })


@app.route("/guess", methods=["POST"])
def guess_letter():
    data = request.get_json() or {}
    letter = str(data.get("letter", "")).upper()

    if not game:
        start_new_game("basic", 1)

    if len(letter) != 1 or not letter.isalpha():
        return jsonify({"error": "Please enter one letter."}), 400

    if letter not in game["guessed"]:
        game["guessed"].append(letter)

        if letter not in game["word"]:
            game["wrong_guesses"] += 1

    word_display = [
        letter if letter in game["guessed"] else "_"
        for letter in game["word"]
    ]

    word_won = "_" not in word_display
    lost = game["wrong_guesses"] >= 6

    word_solved = None
    next_word_length = None
    level_complete = False

    if word_won:
        word_solved = game["word"]
        game["words_found"] += 1

        if game["words_found"] >= game["words_required"]:
            level_complete = True
        else:
            word_length = get_word_length(game["mode"], game["level"])
            game["word"] = random.choice(WORD_BANKS[word_length])
            game["guessed"] = []
            game["wrong_guesses"] = 0
            next_word_length = len(game["word"])

    return jsonify({
        "mode": game["mode"],
        "level": game["level"],
        "word_display": word_display,
        "wrong_guesses": game["wrong_guesses"],
        "won": word_won,
        "lost": lost,
        "answer": game["word"] if lost else None,
        "word_solved": word_solved,
        "words_found": game["words_found"],
        "words_required": game["words_required"],
        "level_complete": level_complete,
        "next_word_length": next_word_length,
    })


if __name__ == "__main__":
    app.run(debug=True)