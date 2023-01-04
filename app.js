const defaultOptions = ["rock", "paper", "scissors"];
const playerOutcomes = ["WIN", "TIE", "LOSE"];
const btns = document.querySelectorAll(".btn");
const outcome = document.querySelector("#outcome");
const turnCounter = document.querySelector("#turnCounter");
const message = document.querySelector("#playerMessage");
const results = document.querySelector("#results");
const maxTurns = 60;
const turnsPerStrategy = 15;
var turnCount = 0;
var endGame = false;

var playerThrow = "";
var playerHistory = [];

var computerThrow = "";
var computerHistory = [];

var outcomeHistory = [];

var strategy = 0;
var playerWin = 0;
var computerWin = 0;

btns.forEach(function (btn) {
  btn.addEventListener("click", function (e) {

    if(endGame)
    {
      return;
    }

    playerThrow = e.currentTarget.id;

    if (turnCount == turnsPerStrategy * 1)
    {
      strategy = 1;
      outcomeHistory.push([playerWin/turnsPerStrategy*1.0, computerWin/turnsPerStrategy*1.0, (turnsPerStrategy-playerWin-computerWin)/turnsPerStrategy*1.0]);
      playerWin = 0;
      computerWin = 0;
    }
    else if(turnCount == turnsPerStrategy * 2)
    {
      strategy = 2;
      outcomeHistory.push([playerWin/turnsPerStrategy*1.0, computerWin/turnsPerStrategy*1.0, (turnsPerStrategy-playerWin-computerWin)/turnsPerStrategy*1.0]);
      playerWin = 0;
      computerWin = 0;
    }
    else if(turnCount == turnsPerStrategy * 3)
    {
      strategy = 3;
      outcomeHistory.push([playerWin/turnsPerStrategy*1.0, computerWin/turnsPerStrategy*1.0, (turnsPerStrategy-playerWin-computerWin)/turnsPerStrategy*1.0]);
      playerWin = 0;
      computerWin = 0;
    }

    if (strategy == 0)
    {
      computerThrow = getRandomThrow(defaultOptions);
    }
    else if(strategy == 1)
    {
      computerThrow = previousThrow(playerHistory[turnCount-1], outcomeHistory[turnCount-1]);
    }
    else if(strategy == 2)
    {
      computerThrow = sequential(defaultOptions, turnCount);
    }
    else
    {
      let playerExpectedThrow = getRandomThrow(playerHistory);
      if (playerExpectedThrow == "rock")
      {
        computerThrow = "paper";
      }
      else if(playerExpectedThrow == "paper")
      {
        computerThrow = "scissors";
      }
      else
      {
        computerThrow = "rock";
      }
    }

    playerHistory.push(playerThrow);
    computerHistory.push(computerThrow);
    var currentOutcome = evaluateThrow(playerThrow, computerThrow);
    if (currentOutcome == 0)
    {
      playerWin++;
    }
    else if (currentOutcome == 2)
    {
      computerWin++;
    }

    outcome.textContent = "Computer threw " + computerThrow + ". " + "You " + playerOutcomes[currentOutcome];

    turnCount++;
    turnCounter.textContent = turnCount + " out of " + maxTurns;

    if(turnCount >= maxTurns)
    {
      outcomeHistory.push([playerWin/turnsPerStrategy*1.0, computerWin/turnsPerStrategy*1.0, (turnsPerStrategy-playerWin-computerWin)/turnsPerStrategy*1.0]);
      message.textContent = "Thank you! Please copy & paste the text below and send to Tyler: briandsmith1@gmail.com";
      endGame = true;
      results.textContent = formatResults();
      results.style.visibility = "visible";
    }
  });
});

function formatResults()
{
  var resultStr = "";
  for (let i = 0; i < outcomeHistory.length; i++) {
      resultStr += "Strategy " + i + ": " + outcomeHistory[i] + "\n";
  }
  for (let i = 0; i < playerHistory.length; i++) {
    resultStr +=  playerHistory[i] + ": " + computerHistory[i] + "\n";
  }
  return resultStr;
}

function previousThrow(previousPlayerThrow, previousResult)
{ 
  if (previousResult == 0)
  {
    if(previousPlayerThrow == "rock")
    {
      return "paper";
    }
    else if(previousPlayerThrow == "paper")
    {
      return "scissors";
    }
    else
    {
      return "rock";
    }
  }
  else
  {
    return previousPlayerThrow;
  }
}

function sequential(options, turnCount)
{
  return options[turnCount % options.length];
}

function getRandomThrow(options) {
  return options[Math.floor(Math.random() * options.length)];
}

function evaluateThrow(player, computer) {
  if (player == computer)
  {
    return 1;
  }
  else if(  (player == "rock" && computer == "scissors") || 
            (player == "scissors" && computer == "paper") || 
            (player == "paper" && computer == "rock"))
  {
    return 0;
  }
  else
  {
    return 2;
  }
}
