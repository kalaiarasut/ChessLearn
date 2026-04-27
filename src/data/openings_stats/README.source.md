#  ♟️ Chess Openings Analysis

This project aims to deepen my knowledge and expand my practices in analyzing large sets of data. I used java to parse a CSV file from [Kaggle](https://www.kaggle.com/datasets/alexandrelemercier/all-chess-openings), with a goal to answer the following questions:
* Which openings by their ECO codes are considered "good"? For white (who has first-move advantage), a win rate above 50% is considered high, and 45% for black. 
* Do more developed openings correlate to higher win percentages? Does this differ significantly between white and black? Whether or not an opening is "developed" is dependent on its number of moves. 
* Is there a correlation between an opening's popularity (number of games played) and its success rate?
* Are there specific groups of openings (same ECO code) most commonly used by higher-rated players (top 25%)? If so, what are they?

Deriving solutions involved basic statistics (correlation, transformations) and can be found in the file entitled WriteUp.txt

--- 

## 🦾 Tech Stack
- Java

---

## 📁 Project Structure
```
chess-openings-analysis
├── data/
│   └── openings.csv
├── src/
│   ├── ChessOpening.java
│   ├── ChessOpeningTester.java
│   └── ChessOpeningsAnalysis.java
├── .DS_Store
├── LICENSE
├── README.md
└── WriteUp.txt
```

---
## 🧾 License
This project is licensed under the [MIT License](LICENSE).

---

## 🙋‍♂️ Maintainer

Drae Angela Vizcarra
GitHub: [@draeangela](https://github.com/draeangela)
