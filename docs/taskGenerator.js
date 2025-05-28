const result = [...Array(100)].map((_, i) => ["", "", "", -1, ""]);


const answerLog = new Map();


// アクティブ状態を設定する関数
function setActiveButton(activeButton, inactiveButton) {
    // アクティブボタンにクラスを追加
    activeButton.classList.add("active");

    // 非アクティブボタンからクラスを削除
    inactiveButton.classList.remove("active");
}



// ---------------------------------------------------
// AnswerLogを処理して統計情報を生成する関数
// ---------------------------------------------------
function processAnswerLog(answerLog) {
    const sets = new Map(); // setIndex -> { choices, records: [{ item, isCorrect }] }
    const itemStats = new Map(); // item -> { correct, total }

    let totalCorrect = 0;
    let totalQuestions = 0;

    for (const entry of answerLog.values()) {
        const { set, choices, question, isCorrect } = entry;
        const item = choices[question];

        // セット内の choices を1回だけ保存
        if (!sets.has(set)) {
            sets.set(set, { choices: choices, records: [] });
        }

        sets.get(set).records.push({ item, isCorrect });

        if (!itemStats.has(item)) itemStats.set(item, { correct: 0, total: 0 });
        const stats = itemStats.get(item);
        stats.total++;
        if (isCorrect) stats.correct++;

        totalQuestions++;
        if (isCorrect) totalCorrect++;
    }

    return { sets, itemStats, totalCorrect, totalQuestions };
}


// ---------------------------------------------------
// Section3を生成する関数
// ---------------------------------------------------
function generateSectionOverall(correct, total) {
    const percent = Math.round((correct / total) * 100);
    return `全体 ${correct}/${total} = ${percent}`;
}

// ---------------------------------------------------
// Section2を生成する関数
// ---------------------------------------------------
function generateSectionPerItem(itemStats) {
    let lines = [];

    for (const [item, stats] of itemStats.entries()) {
        const percent = Math.round((stats.correct / stats.total) * 100);
        lines.push(`${item} ${stats.correct}/${stats.total} = ${percent}`);
    }

    return lines.join("<br>");
}


// ---------------------------------------------------
// Section1を生成する関数
// ---------------------------------------------------
function generateSectionPerSet(sets) {
    let lines = [];

    for (const [setIndex, { choices, records }] of sets.entries()) {
        const uniqueItems = choices; // 順番を保った元の choices

        const itemPair = uniqueItems.join(" vs ");
        const correctCount = records.filter(r => r.isCorrect).length;
        const totalCount = records.length;

        const history = records.map((r) => {
            const letterIndex = uniqueItems.indexOf(r.item); // a, b, ...
            const letter = String.fromCharCode(97 + letterIndex);
            return r.isCorrect ? letter.toUpperCase() : letter.toLowerCase();
        }).join("");

        lines.push(`${itemPair}: ${correctCount}/${totalCount} = ${Math.round(correctCount / totalCount * 100)} (${history})`);
    }

    return lines.join("<br>");
}

// ---------------------------------------------------
//  統計情報を生成する関数
// ---------------------------------------------------
function generateAnswerSummary(answerLog) {
    const { sets, itemStats, totalCorrect, totalQuestions } = processAnswerLog(answerLog);

    const section1 = generateSectionPerSet(sets);
    const section2 = generateSectionPerItem(itemStats);
    const section3 = generateSectionOverall(totalCorrect, totalQuestions);

    // console.log("section1", section1);
    // console.log("section2", section2);
    // console.log("section3", section3);

    return `${section1}<br><br>${section2}<br><br>${section3}`;
}

// ---------------------------------------------------
// ボタンが押された時に実行される関数
// ---------------------------------------------------
function recordAnswer(choices, questionIndex, setIndex, repetitionIndex, isCorrect) {


    const key = `${setIndex}-${repetitionIndex}`; // ユニークキーとして文字列を作成

    answerLog.set(key, {
        set: setIndex,
        repetition: repetitionIndex,
        choices: choices,
        question: questionIndex,
        isCorrect: isCorrect
    });

    console.log("Answer updated:", answerLog.get(key));

    document.getElementById("output").innerHTML = generateAnswerSummary(answerLog);

}

// ---------------------------------------------------
// 課題の組合せに対して重み付きランダム選択を行う
// ---------------------------------------------------
function weightedRandomChoice(items, usageCounts) {
    let maxUsage = Math.max(...items.map(item => usageCounts[item] || 0));
    let weightedItems = items.map((item, index) => {
        let usage = usageCounts[item] || 0;
        let weight = (maxUsage - usage) + 1; // 使用が少ないほど重い
        return { index, item, weight };
    });

    let totalWeight = weightedItems.reduce((sum, obj) => sum + obj.weight, 0);
    let r = Math.random() * totalWeight;

    for (let { index, item, weight } of weightedItems) {
        if (r < weight) return index; // item;
        r -= weight;
    }

    // return weightedItems[weightedItems.length - 1].item; // fallback（理論上不要）
}

function weightedRandomChoiceBalanced(items, usageCounts) {
    // 使用回数の一覧
    let usages = items.map(item => usageCounts[item] || 0);
    let minUsage = Math.min(...usages);

    // 使用回数が minUsage または minUsage+1 のものだけに限定
    let filteredItems = items
        .map((item, index) => ({ item, index, usage: usageCounts[item] || 0 }))
        .filter(entry => entry.usage <= minUsage + 1);

    // 使用回数が少ないほどやや高くなる重みを与える（±1以内なので偏りは小さい）
    let weightedItems = filteredItems.map(entry => {
        return {
            index: entry.index,
            weight: (minUsage + 2 - entry.usage), // usage=min → weight=2, usage=min+1 → weight=1
        };
    });

    let totalWeight = weightedItems.reduce((sum, obj) => sum + obj.weight, 0);
    let r = Math.random() * totalWeight;

    for (let { index, weight } of weightedItems) {
        if (r < weight) return index;
        r -= weight;
    }
}

function weightedRandomChoiceFair(items, usageCounts) {
    // 全候補の中で最小の使用回数を探す
    let minUsage = Math.min(...items.map(item => usageCounts[item] || 0));

    // 使用回数が最小のアイテムをすべて取得
    let leastUsed = items.filter(item => (usageCounts[item] || 0) === minUsage);

    // その中からランダムに選ぶ（完全均等）
    const chosen = leastUsed[Math.floor(Math.random() * leastUsed.length)];

    // index を返す（choices 中での位置）
    return items.indexOf(chosen);
}

// ---------------------------------------------------
// 課題の組合せを生成する
// ---------------------------------------------------
function generateTask(selectedItems, choiceCount, repetitionCount, setCount) {

    let usageCounts = {};
    selectedItems.forEach(item => usageCounts[item] = 0);

    let localItemBins = new Map();

    selectedItems.forEach(item => localItemBins.set(item, 0));

    // 出力するセットをここに保存
    let sets = [];

    for (let s = 0; s < setCount; s++) {

        // 同じ使用回数のときにランダム化
        let sortedItems = [...localItemBins.entries()]
            .map(entry => ({ key: entry[0], value: entry[1], rand: Math.random() }))
            .sort((a, b) => {
                if (a.value === b.value) {
                    return a.rand - b.rand;
                }
                return a.value - b.value;
            })
            .map(entry => entry.key);

        // 上位 N 個を抽出（必要な choiceCount 個）
        let topEntries = sortedItems.slice(0, choiceCount);

        // その中だけシャッフル（ランダム性を導入）
        for (let i = topEntries.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [topEntries[i], topEntries[j]] = [topEntries[j], topEntries[i]];
        }

        // 選ばれたアイテムの出現回数を増やす
        topEntries.forEach(item => {
            localItemBins.set(item, localItemBins.get(item) + 1);
        });

        // 各 repetition に対して、1つずつ問題を選ぶ
        let questions = [];
        for (let r = 0; r < repetitionCount; r++) {
            let q = weightedRandomChoiceBalanced(topEntries, usageCounts);
            questions.push(q);
            usageCounts[q]++;
        }

        sets.push({
            choices: topEntries,
            questions: questions
        });
    }

    return sets;

}

// ---------------------------------------------------
// Yes/Noボタンを生成する関数
// ---------------------------------------------------
function createYesNoButton(scroll_length, questionText, choices, question, setIndex, repetitionIndex, repetitionCount) {

    const buttonsDiv = document.createElement("div");
    buttonsDiv.className = "buttons";

    const yesButton = document.createElement("button");
    yesButton.style.marginRight = "20px"; // ボタン間に間隔を設ける
    yesButton.className = "button";
    yesButton.textContent = "正";
    yesButton.addEventListener("click", () => {

        recordAnswer(choices, question, setIndex, repetitionIndex, true);

        setActiveButton(yesButton, noButton); // Yesボタンをアクティブに
        window.scrollBy({
            top: scroll_length, // 下にスクロール
            left: 0,
            behavior: "smooth" // スムーズなスクロール
        });
    });


    const noButton = document.createElement("button");
    noButton.className = "button";
    noButton.textContent = "誤";
    noButton.addEventListener("click", () => {

        recordAnswer(choices, question, setIndex, repetitionIndex, false);

        setActiveButton(noButton, yesButton); // Noボタンをアクティブに
        window.scrollBy({
            top: scroll_length, // 下にスクロール
            left: 0,
            behavior: "smooth" // スムーズなスクロール
        });
    });

    buttonsDiv.appendChild(yesButton);
    buttonsDiv.appendChild(noButton);

    return buttonsDiv;
}

// ---------------------------------------------------
// 質問ごとのコンテントを生成する
// ---------------------------------------------------
function createQuestionContent(choices, question, setIndex, repetitionIndex, repetitionCount) {

    const questionDiv = document.createElement("div");
    questionDiv.className = "question";

    let count = setIndex * repetitionCount + repetitionIndex;

    const questionText = document.createElement("p");
    if (repetitionIndex === 0) {
        questionText.innerHTML = `<hr> ${choices} <hr> <br> ${count + 1}: ${choices[question]}`;
    } else {
        questionText.innerHTML = `${count + 1}: ${choices[question]}`;
    }

    questionDiv.appendChild(questionText);

    const scroll_length = (repetitionIndex === repetitionCount - 1) ? 177 : 100;

    let buttons = createYesNoButton(scroll_length, questionText, choices, question, setIndex, repetitionIndex, repetitionCount);

    questionDiv.appendChild(buttons);

    return questionDiv;

}

// ---------------------------------------------------
// 課題のコンテントを生成する
// ---------------------------------------------------
function createTaskContent(selectedItems, choiceCount, repetitionCount, setCount) {

    const tasks = generateTask(selectedItems, choiceCount, repetitionCount, setCount);

    const container = document.getElementById("questions-container");
    container.innerHTML = ""; // 古い内容を削除

    let counter = 0;

    let setIndex = 0;


    tasks.forEach(task => {

        let repetitionIndex = 0;

        const { choices, questions } = task;

        questions.forEach((question, index) => {

            let qdiv = createQuestionContent(choices, question, setIndex, repetitionIndex, repetitionCount);

            container.appendChild(qdiv);

            counter++;

            repetitionIndex++;

        })

        setIndex++;
    })



}

// ---------------------------------------------------
// 「課題を生成する」ボタン
// ---------------------------------------------------

document.getElementById('generateTaskButton').addEventListener('click', function () {

    answerLog.clear();

    // 択数，レップ数，セット数を取得する
    let choiceCount = parseInt(document.getElementById('choiceCount').value);
    let repetitionCount = parseInt(document.getElementById('repetitionCount').value);
    let setCount = parseInt(document.getElementById('setCount').value);

    // 表示中のグループからチェックされている値だけ取得
    const visibleGroup = document.getElementById(currentVisibleGroupId);
    const checkboxes = visibleGroup.querySelectorAll('input[type="checkbox"]');
    const selectedItems = Array.from(checkboxes)
        .filter(checkbox => checkbox.checked)
        .map(checkbox => checkbox.value);

    // 課題結果のテキストエリアをクリアする
    document.getElementById("output").innerHTML = "";

    // 課題を生成する関数を呼び出す
    createTaskContent(selectedItems, choiceCount, repetitionCount, setCount);
});


// document.getElementById('generateTaskButton').addEventListener('click', function () {

//     answerLog.clear();

//     // 択数，レップ数，セット数を取得する
//     let choiceCount = document.getElementById('choiceCount').value;
//     let repetitionCount = document.getElementById('repetitionCount').value;
//     let setCount = document.getElementById('setCount').value;

//     // 
//     const visibleGroup = document.getElementById(currentVisibleGroupId);
//     const checkboxes = visibleGroup.querySelectorAll('input[type="checkbox"]');
//     return Array.from(checkboxes)
//         .filter(checkbox => checkbox.checked)
//         .map(checkbox => checkbox.value);
        

//     // 課題結果のテキストエリアをクリアする
//     document.getElementById("output").innerHTML = "";

//     // 課題を生成する関数を呼び出す
//     // displayQuestions(selectedItems, choiceCount, repetitionCount, setCount);

//     // console.log("CHECK",selectedItems, choiceCount, repetitionCount, setCount);

//     let result = generateTask(selectedItems, choiceCount, repetitionCount, setCount);

//     createTaskContent(selectedItems, choiceCount, repetitionCount, setCount);

//     console.log(result);

// });


// ---------------------------------------------------
// コピーボタン
// ---------------------------------------------------
document.getElementById("copyButton").addEventListener("click", () => {

    // 出力要素を取得
    const output = document.getElementById("output");
    const textToCopy = output.innerText; // または innerText を使用

    // クリップボードにコピー
    navigator.clipboard.writeText(textToCopy).then(() => {
        alert("クリップボードにコピーしました！");
    }).catch(err => {
        console.error("コピーに失敗しました: ", err);
        alert("コピーに失敗しました。");
    });
});

// ---------------------------------------------------
// コピーボタン
// ---------------------------------------------------
let currentVisibleGroupId = 'group1'; // 初期表示グループ

function showGroup(groupId) {
    document.querySelectorAll('.checkbox-group').forEach(group => {
        group.style.display = (group.id === groupId) ? 'block' : 'none';
    });

    document.querySelectorAll('.group-button').forEach(button => {
        button.classList.toggle('active', button.dataset.group === groupId);
    });

    currentVisibleGroupId = groupId;
}


// Safari対応のため、ロード時に明示的に初期グループを設定
window.addEventListener("DOMContentLoaded", () => {
    showGroup(currentVisibleGroupId);
});
