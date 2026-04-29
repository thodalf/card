import React, { useState, useEffect } from 'react';
import { SkipForward, Smartphone, BookOpen, ArrowLeft } from 'lucide-react';
import { createGame, joinGame, updateGame, subscribeToGame } from './firebase';

const TacticalCardGame = () => {
  const [gameMode, setGameMode] = useState('menu');
  const [currentPlayer, setCurrentPlayer] = useState(1);
  const [actionsUsed, setActionsUsed] = useState({ place: false, moveCount: 0, attack: false });
  const [movedCards, setMovedCards] = useState(new Set());
  const [board, setBoard] = useState(Array(25).fill(null));
  const [player1Hand, setPlayer1Hand] = useState([]);
  const [player2Hand, setPlayer2Hand] = useState([]);
  const [message, setMessage] = useState('');
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverCell, setDragOverCell] = useState(null);
  const [animatingCells, setAnimatingCells] = useState({});
  const [damagedValues, setDamagedValues] = useState({});
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState(null);
  const [roomCode, setRoomCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [playerNumber, setPlayerNumber] = useState(null);
  const [isWaiting, setIsWaiting] = useState(false);
  const [onlineError, setOnlineError] = useState('');

  const playSound = (type) => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      if (type === 'place') {
        // Son de placement : ton ascendant
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + 0.1);
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
      }
      
      if (type === 'move') {
        // Son de déplacement : swoosh
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.15);
        
        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.15);
      }
      
      if (type === 'attack') {
        // Son d'attaque : impact
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(150, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 0.1);
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
      }
      
      if (type === 'destroy') {
        // Son de destruction : explosion
        const noise = audioContext.createBufferSource();
        const bufferSize = audioContext.sampleRate * 0.5;
        const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
        }
        
        noise.buffer = buffer;
        
        const filter = audioContext.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1000, audioContext.currentTime);
        filter.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 0.5);
        
        const gainNode = audioContext.createGain();
        gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        noise.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        noise.start(audioContext.currentTime);
        noise.stop(audioContext.currentTime + 0.5);
        
        // Ajouter un boom grave
        const boom = audioContext.createOscillator();
        const boomGain = audioContext.createGain();
        boom.connect(boomGain);
        boomGain.connect(audioContext.destination);
        
        boom.type = 'sine';
        boom.frequency.setValueAtTime(80, audioContext.currentTime);
        boom.frequency.exponentialRampToValueAtTime(20, audioContext.currentTime + 0.3);
        
        boomGain.gain.setValueAtTime(0.5, audioContext.currentTime);
        boomGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        
        boom.start(audioContext.currentTime);
        boom.stop(audioContext.currentTime + 0.3);
      }
    } catch (err) {
      console.log('Sound playback failed:', err);
    }
  };

  const checkGameOver = () => {
    const player1Cards = board.filter(cell => cell && cell.owner === 1).length + player1Hand.length;
    const player2Cards = board.filter(cell => cell && cell.owner === 2).length + player2Hand.length;
    
    if (player1Cards === 0) {
      setGameOver(true);
      setWinner(2);
      return true;
    }
    if (player2Cards === 0) {
      setGameOver(true);
      setWinner(1);
      return true;
    }
    return false;
  };

  const toggleMusic = () => {
    const audio = document.getElementById('game-music');
    if (audio) {
      if (isMusicPlaying) {
        audio.pause();
        setIsMusicPlaying(false);
      } else {
        audio.volume = 0.3;
        audio.play()
          .then(() => setIsMusicPlaying(true))
          .catch(err => {
            console.log('Erreur lecture audio:', err);
            alert('Impossible de lire la musique. Vérifiez les paramètres de votre navigateur.');
          });
      }
    }
  };

  const generateDeck = () => {
    const deck = [];
    const deckSize = 6;
    const targetPoints = 100;
    
    const distributions = [
      { min: 8, max: 12 },
      { min: 8, max: 12 },
      { min: 14, max: 18 },
      { min: 14, max: 18 },
      { min: 20, max: 28 },
      { min: 20, max: 28 }
    ];
    
    distributions.sort(() => Math.random() - 0.5);
    let totalAllocated = 0;
    
    for (let i = 0; i < deckSize; i++) {
      let cardPoints;
      
      if (i === deckSize - 1) {
        cardPoints = targetPoints - totalAllocated;
      } else {
        const dist = distributions[i];
        cardPoints = Math.floor(Math.random() * (dist.max - dist.min + 1)) + dist.min;
        totalAllocated += cardPoints;
      }
      
      const values = { 
        top: 0, right: 0, bottom: 0, left: 0, 
        topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 
      };
      
      for (let j = 0; j < cardPoints; j++) {
        const keys = Object.keys(values);
        const randomKey = keys[Math.floor(Math.random() * keys.length)];
        
        if (values[randomKey] < 9) {
          values[randomKey]++;
        } else {
          j--;
        }
      }
      
      deck.push({ 
        id: 'card-' + i + '-' + Date.now() + '-' + Math.random(), 
        ...values,
        originalValues: { ...values }
      });
    }
    
    return deck;
  };

  const startLocalGame = () => {
    const p1Deck = generateDeck();
    const p2Deck = generateDeck();
    
    setPlayer1Hand([...p1Deck]);
    setPlayer2Hand([...p2Deck]);
    setGameMode('local');
    setMessage('Joueur 1 commence');
    setPlayerNumber(null);
  };

  const generateRoomCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const createOnlineGame = async () => {
    try {
      const code = generateRoomCode();
      const p1Deck = generateDeck();
      
      const gameState = {
        player1Hand: p1Deck,
        player2Hand: null,
        board: Array(25).fill(null),
        currentPlayer: 1,
        actionsUsed: { place: false, moveCount: 0, attack: false },
        movedCards: [],
        damagedValues: {},
        message: 'En attente du joueur 2...',
        gameOver: false,
        winner: null,
        createdAt: Date.now()
      };
      
      await createGame(code, gameState); // ← Changé
      
      setRoomCode(code);
      setPlayerNumber(1);
      setPlayer1Hand(p1Deck);
      setBoard(Array(25).fill(null));
      setCurrentPlayer(1);
      setIsWaiting(true);
      setGameMode('online');
      setMessage('En attente du joueur 2...');
      // pollGameState(code, 1); ← SUPPRIMÉ
    } catch (error) {
      setOnlineError('Erreur lors de la création de la partie');
      console.error(error);
    }
  };

  const joinOnlineGame = async () => {
    if (!inputCode || inputCode.length !== 6) {
      setOnlineError('Code invalide (6 caractères requis)');
      return;
    }
    
    try {
      const code = inputCode.toUpperCase();
      const gameState = await joinGame(code); // ← Changé
      
      if (!gameState) {
        setOnlineError('Code de partie introuvable');
        return;
      }
      
      if (gameState.player2Hand) {
        setOnlineError('Cette partie est déjà complète');
        return;
      }
      
      const p2Deck = generateDeck();
      gameState.player2Hand = p2Deck;
      gameState.message = 'Joueur 1 commence';
      
      await updateGame(code, gameState); // ← Changé
      
      setRoomCode(code);
      setPlayerNumber(2);
      setPlayer1Hand(gameState.player1Hand);
      setPlayer2Hand(p2Deck);
      setBoard(gameState.board);
      setCurrentPlayer(gameState.currentPlayer);
      setGameMode('online');
      setIsWaiting(false);
      setMessage('Joueur 1 commence');
      setOnlineError('');
      // pollGameState(code, 2); ← SUPPRIMÉ
    } catch (error) {
      setOnlineError('Erreur lors de la connexion');
      console.error(error);
    }
  };

  useEffect(() => {
    if (gameMode !== 'online' || !roomCode) return;
  
    const unsubscribe = subscribeToGame(roomCode, (gameState) => {
      if (playerNumber === 1 && isWaiting && gameState.player2Hand) {
        setPlayer2Hand(gameState.player2Hand);
        setIsWaiting(false);
        setMessage('Joueur 1 commence');
        return;
      }
  
      if (gameState.currentPlayer !== playerNumber || gameState.gameOver) {
        setBoard(gameState.board || Array(25).fill(null));
        setCurrentPlayer(gameState.currentPlayer);
        setPlayer1Hand(gameState.player1Hand || []);
        if (gameState.player2Hand) setPlayer2Hand(gameState.player2Hand);
        setActionsUsed(gameState.actionsUsed || { place: false, moveCount: 0, attack: false });
        setMovedCards(new Set(gameState.movedCards || []));
        setDamagedValues(gameState.damagedValues || {});
        setMessage(gameState.message || '');
        setGameOver(gameState.gameOver || false);
        setWinner(gameState.winner || null);
      }
    });
  
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [gameMode, roomCode, playerNumber, isWaiting]);

  const pollGameState = (code, myPlayerNumber) => {
    const interval = setInterval(async () => {
      try {
        const gameState = await joinGame(code);
        if (!gameState) {
          setOnlineError('Code introuvable');
          return;
        }
        
        // Si le joueur 2 a rejoint
        if (myPlayerNumber === 1 && gameState.player2Hand && isWaiting) {
          setPlayer2Hand(gameState.player2Hand);
          setIsWaiting(false);
          setMessage('Joueur 1 commence');
        }
        
        // Synchroniser l'état si ce n'est pas notre tour
        if (gameState.currentPlayer !== myPlayerNumber || gameState.gameOver) {
          setBoard(gameState.board);
          setCurrentPlayer(gameState.currentPlayer);
          setPlayer1Hand(gameState.player1Hand);
          if (gameState.player2Hand) setPlayer2Hand(gameState.player2Hand);
          setActionsUsed(gameState.actionsUsed);
          setMovedCards(new Set(gameState.movedCards));
          setDamagedValues(gameState.damagedValues);
          setMessage(gameState.message);
          setGameOver(gameState.gameOver);
          setWinner(gameState.winner);
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 1500);
    
    return () => clearInterval(interval);
  };

  const syncGameState = async () => {
    if (gameMode !== 'online' || !roomCode) return;
    
    try {
      const gameState = {
        player1Hand: player1Hand,
        player2Hand: player2Hand,
        board: board,
        currentPlayer: currentPlayer,
        actionsUsed: actionsUsed,
        movedCards: Array.from(movedCards),
        damagedValues: damagedValues,
        message: message,
        gameOver: gameOver,
        winner: winner,
        lastUpdate: Date.now()
      };
      
      await updateGame(roomCode, gameState); // ← Changé
    } catch (error) {
      console.error('Sync error:', error);
    }
  };

  // Synchroniser à chaque changement d'état important
  useEffect(() => {
    if (gameMode === 'online' && !isWaiting) {
      syncGameState();
    }
  }, [board, currentPlayer, player1Hand, player2Hand, actionsUsed, message, gameOver]);

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    setMessage('Code copié dans le presse-papiers !');
    setTimeout(() => setMessage('En attente du joueur 2...'), 2000);
  };

  const triggerAnimation = (index, type) => {
    setAnimatingCells(prev => ({ ...prev, [index]: type }));
    setTimeout(() => {
      setAnimatingCells(prev => {
        const newState = { ...prev };
        delete newState[index];
        return newState;
      });
    }, type === 'destroy' ? 1200 : 600);
  };

  const isCorner = (index) => {
    return index === 0 || index === 4 || index === 20 || index === 24;
  };

  const isPlayerZone = (index, player) => {
    if (player === 1) return index >= 0 && index <= 9;
    if (player === 2) return index >= 15 && index <= 24;
    return false;
  };

  const getAdjacentCells = (index, includeDiagonal) => {
    const row = Math.floor(index / 5);
    const col = index % 5;
    const adjacent = [];

    if (row > 0) adjacent.push(index - 5);
    if (row < 4) adjacent.push(index + 5);
    if (col > 0) adjacent.push(index - 1);
    if (col < 4) adjacent.push(index + 1);

    if (includeDiagonal) {
      if (row > 0 && col > 0) adjacent.push(index - 6);
      if (row > 0 && col < 4) adjacent.push(index - 4);
      if (row < 4 && col > 0) adjacent.push(index + 4);
      if (row < 4 && col < 4) adjacent.push(index + 6);
    }

    return adjacent.filter(i => !isCorner(i));
  };

  const handlePlaceCard = (cardIndex, boardIndex) => {
    if (gameMode === 'online' && playerNumber !== currentPlayer) {
      setMessage('Ce n\'est pas votre tour !');
      return false;
    }
    
    if (actionsUsed.place) {
      setMessage('Vous avez déjà placé une carte ce tour !');
      return false;
    }

    if (!isPlayerZone(boardIndex, currentPlayer)) {
      setMessage('Vous ne pouvez placer une carte que dans votre zone !');
      return false;
    }

    if (board[boardIndex]) {
      setMessage('Cet emplacement est déjà occupé !');
      return false;
    }

    const newBoard = [...board];
    const currentHand = currentPlayer === 1 ? [...player1Hand] : [...player2Hand];
    const card = currentHand[cardIndex];
    
    newBoard[boardIndex] = { ...card, owner: currentPlayer };
    currentHand.splice(cardIndex, 1);

    triggerAnimation(boardIndex, 'place');
    playSound('place');
    setBoard(newBoard);
    if (currentPlayer === 1) setPlayer1Hand(currentHand);
    else setPlayer2Hand(currentHand);

    setActionsUsed({ ...actionsUsed, place: true });
    setMessage('Carte placée !');
    return true;
  };

  const handleMoveCard = (fromIndex, toIndex) => {
    if (gameMode === 'online' && playerNumber !== currentPlayer) {
      setMessage('Ce n\'est pas votre tour !');
      return false;
    }
    
    if (actionsUsed.moveCount >= 2) {
      setMessage('Vous avez déjà effectué 2 déplacements ce tour !');
      return false;
    }

    if (movedCards.has(fromIndex)) {
      setMessage('Cette carte a déjà été déplacée ce tour !');
      return false;
    }

    if (!board[fromIndex] || board[fromIndex].owner !== currentPlayer) {
      setMessage('Cette carte ne vous appartient pas !');
      return false;
    }

    const adjacent = getAdjacentCells(fromIndex, true);
    if (!adjacent.includes(toIndex)) {
      setMessage('Vous ne pouvez déplacer que d\'un emplacement !');
      return false;
    }

    if (board[toIndex]) {
      setMessage('Cet emplacement est déjà occupé !');
      return false;
    }

    const newBoard = [...board];
    newBoard[toIndex] = newBoard[fromIndex];
    newBoard[fromIndex] = null;

    triggerAnimation(toIndex, 'move');
    playSound('move');
    setBoard(newBoard);
    setActionsUsed({ ...actionsUsed, moveCount: actionsUsed.moveCount + 1 });
    setMovedCards(new Set([...movedCards, toIndex]));
    setMessage('Carte déplacée ! (' + (actionsUsed.moveCount + 1) + '/2)');
    return true;
  };

  const handleAttack = (attackerIndex, defenderIndex) => {
    if (gameMode === 'online' && playerNumber !== currentPlayer) {
      setMessage('Ce n\'est pas votre tour !');
      return false;
    }
    
    if (actionsUsed.attack) {
      setMessage('Vous avez déjà attaqué ce tour !');
      return false;
    }

    const attacker = board[attackerIndex];
    const defender = board[defenderIndex];

    if (!attacker || attacker.owner !== currentPlayer) {
      setMessage('Cette carte ne vous appartient pas !');
      return false;
    }

    if (!defender || defender.owner === currentPlayer) {
      setMessage('Vous devez attaquer une carte adverse !');
      return false;
    }

    const adjacent = getAdjacentCells(attackerIndex, false);
    if (!adjacent.includes(defenderIndex)) {
      setMessage('Vous ne pouvez attaquer qu\'une carte adjacente !');
      return false;
    }

    triggerAnimation(attackerIndex, 'attack');
    triggerAnimation(defenderIndex, 'attack');
    playSound('attack');

    setTimeout(() => {
      const newBoard = [...board];
      let attackerDestroyed = false;
      let defenderDestroyed = false;

      const newAttacker = { ...attacker };
      const newDefender = { ...defender };

      const rowDiff = Math.floor(defenderIndex / 5) - Math.floor(attackerIndex / 5);
      const colDiff = (defenderIndex % 5) - (attackerIndex % 5);

      const attackerDamaged = {};
      const defenderDamaged = {};

      if (rowDiff === -1 && colDiff === 0) {
        newAttacker.top -= 1; attackerDamaged.top = true;
        newAttacker.topLeft -= 1; attackerDamaged.topLeft = true;
        newAttacker.topRight -= 1; attackerDamaged.topRight = true;
        newDefender.bottom -= 1; defenderDamaged.bottom = true;
        newDefender.bottomLeft -= 1; defenderDamaged.bottomLeft = true;
        newDefender.bottomRight -= 1; defenderDamaged.bottomRight = true;
      } else if (rowDiff === 1 && colDiff === 0) {
        newAttacker.bottom -= 1; attackerDamaged.bottom = true;
        newAttacker.bottomLeft -= 1; attackerDamaged.bottomLeft = true;
        newAttacker.bottomRight -= 1; attackerDamaged.bottomRight = true;
        newDefender.top -= 1; defenderDamaged.top = true;
        newDefender.topLeft -= 1; defenderDamaged.topLeft = true;
        newDefender.topRight -= 1; defenderDamaged.topRight = true;
      } else if (rowDiff === 0 && colDiff === -1) {
        newAttacker.left -= 1; attackerDamaged.left = true;
        newAttacker.topLeft -= 1; attackerDamaged.topLeft = true;
        newAttacker.bottomLeft -= 1; attackerDamaged.bottomLeft = true;
        newDefender.right -= 1; defenderDamaged.right = true;
        newDefender.topRight -= 1; defenderDamaged.topRight = true;
        newDefender.bottomRight -= 1; defenderDamaged.bottomRight = true;
      } else if (rowDiff === 0 && colDiff === 1) {
        newAttacker.right -= 1; attackerDamaged.right = true;
        newAttacker.topRight -= 1; attackerDamaged.topRight = true;
        newAttacker.bottomRight -= 1; attackerDamaged.bottomRight = true;
        newDefender.left -= 1; defenderDamaged.left = true;
        newDefender.topLeft -= 1; defenderDamaged.topLeft = true;
        newDefender.bottomLeft -= 1; defenderDamaged.bottomLeft = true;
      }

      Object.values(newAttacker).forEach(val => {
        if (typeof val === 'number' && val < 0) attackerDestroyed = true;
      });

      Object.values(newDefender).forEach(val => {
        if (typeof val === 'number' && val < 0) defenderDestroyed = true;
      });

      const newDamagedValues = { ...damagedValues };
      
      if (!attackerDestroyed) {
        newDamagedValues[attackerIndex] = attackerDamaged;
      }
      if (!defenderDestroyed) {
        newDamagedValues[defenderIndex] = defenderDamaged;
      }

      setDamagedValues(newDamagedValues);

      if (attackerDestroyed && defenderDestroyed) {
        triggerAnimation(attackerIndex, 'destroy');
        triggerAnimation(defenderIndex, 'destroy');
        playSound('destroy');
        setTimeout(() => {
          newBoard[attackerIndex] = null;
          newBoard[defenderIndex] = null;
          const updatedDamaged = { ...newDamagedValues };
          delete updatedDamaged[attackerIndex];
          delete updatedDamaged[defenderIndex];
          setDamagedValues(updatedDamaged);
          setBoard([...newBoard]);
        }, 1200);
        setMessage('💥 Les deux cartes ont été détruites ! 💥');
      } else if (defenderDestroyed) {
        triggerAnimation(defenderIndex, 'destroy');
        playSound('destroy');
        setTimeout(() => {
          newBoard[defenderIndex] = null;
          newBoard[attackerIndex] = newAttacker;
          const updatedDamaged = { ...newDamagedValues };
          delete updatedDamaged[defenderIndex];
          setDamagedValues(updatedDamaged);
          setBoard([...newBoard]);
        }, 1200);
        setMessage('💥 La carte ennemie a été détruite ! 💥');
      } else if (attackerDestroyed) {
        triggerAnimation(attackerIndex, 'destroy');
        playSound('destroy');
        setTimeout(() => {
          newBoard[attackerIndex] = null;
          newBoard[defenderIndex] = newDefender;
          const updatedDamaged = { ...newDamagedValues };
          delete updatedDamaged[attackerIndex];
          setDamagedValues(updatedDamaged);
          setBoard([...newBoard]);
        }, 1200);
        setMessage('💥 Votre carte a été détruite ! 💥');
      } else {
        newBoard[attackerIndex] = newAttacker;
        newBoard[defenderIndex] = newDefender;
        setBoard(newBoard);
        setMessage('⚔️ Combat terminé !');
      }
    }, 600);

    setActionsUsed({ ...actionsUsed, attack: true });
    return true;
  };

  const endTurn = () => {
    if (gameMode === 'online' && playerNumber !== currentPlayer) {
      setMessage('Ce n\'est pas votre tour !');
      return;
    }
    
    if (checkGameOver()) return;
    
    const nextPlayer = currentPlayer === 1 ? 2 : 1;
    setCurrentPlayer(nextPlayer);
    setActionsUsed({ place: false, moveCount: 0, attack: false });
    setMovedCards(new Set());
    setMessage('Joueur ' + nextPlayer + ' commence');
  };

  const handleDragStart = (e, type, index) => {
    setDraggedItem({ type, index });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, cellIndex) => {
    e.preventDefault();
    if (!isCorner(cellIndex)) {
      setDragOverCell(cellIndex);
    }
  };

  const handleDragLeave = () => {
    setDragOverCell(null);
  };

  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    setDragOverCell(null);

    if (!draggedItem || isCorner(targetIndex)) return;

    const dragType = draggedItem.type;
    const dragIndex = draggedItem.index;

    if (dragType === 'hand') {
      handlePlaceCard(dragIndex, targetIndex);
    } else if (dragType === 'board') {
      const sourceCard = board[dragIndex];
      const targetCard = board[targetIndex];

      if (targetCard && targetCard.owner !== currentPlayer) {
        handleAttack(dragIndex, targetIndex);
      } else {
        handleMoveCard(dragIndex, targetIndex);
      }
    }

    setDraggedItem(null);
  };

  const calculateCardTotal = (card) => {
    return card.top + card.right + card.bottom + card.left + 
           card.topLeft + card.topRight + card.bottomRight + card.bottomLeft;
  };

  const calculateDeckTotal = (hand) => {
    return hand.reduce((sum, card) => sum + calculateCardTotal(card), 0);
  };
  
  const calculateBoardTotal = (player) => {
    return board.reduce((sum, cell) => {
      if (cell && cell.owner === player) {
        return sum + calculateCardTotal(cell);
      }
      return sum;
    }, 0);
  };

  const CardDisplay = (props) => {
    const card = props.card;
    const small = props.small || false;
    const cellIndex = props.cellIndex || null;
    const owner = props.owner || null;
    
    const cardTotal = calculateCardTotal(card);
    
    const damaged = cellIndex !== null ? damagedValues[cellIndex] : {};
    const isDamaged = (key) => damaged && damaged[key];
    
    let bgGradient = 'from-blue-500 to-purple-600';
    if (owner === 1) bgGradient = 'from-blue-600 to-blue-800';
    if (owner === 2) bgGradient = 'from-red-600 to-red-800';
    
    const sizeClass = small ? 'w-full h-full' : 'w-full h-full';
    const topClass = small ? 'top-1 text-xs' : 'top-1.5 text-base';
    const rightClass = small ? 'right-1 text-xs' : 'right-1.5 text-base';
    const bottomClass = small ? 'bottom-1 text-xs' : 'bottom-1.5 text-base';
    const leftClass = small ? 'left-1 text-xs' : 'left-1.5 text-base';
    const cornerClass = small ? 'text-[10px]' : 'text-xs';
    const totalClass = small ? 'text-base' : 'text-xl';
    
    return React.createElement('div', {
      className: 'relative ' + sizeClass + ' bg-gradient-to-br ' + bgGradient + ' rounded-lg border-2 border-yellow-400 flex items-center justify-center shadow-lg'
    },
      React.createElement('div', { className: 'absolute ' + topClass + ' left-1/2 transform -translate-x-1/2 font-bold drop-shadow-lg ' + (isDamaged('top') ? 'text-red-500' : 'text-white') }, card.top),
      React.createElement('div', { className: 'absolute ' + rightClass + ' top-1/2 transform -translate-y-1/2 font-bold drop-shadow-lg ' + (isDamaged('right') ? 'text-red-500' : 'text-white') }, card.right),
      React.createElement('div', { className: 'absolute ' + bottomClass + ' left-1/2 transform -translate-x-1/2 font-bold drop-shadow-lg ' + (isDamaged('bottom') ? 'text-red-500' : 'text-white') }, card.bottom),
      React.createElement('div', { className: 'absolute ' + leftClass + ' top-1/2 transform -translate-y-1/2 font-bold drop-shadow-lg ' + (isDamaged('left') ? 'text-red-500' : 'text-white') }, card.left),
      React.createElement('div', { className: 'absolute top-0.5 left-0.5 ' + cornerClass + ' font-bold drop-shadow-lg ' + (isDamaged('topLeft') ? 'text-red-400' : 'text-yellow-300') }, card.topLeft),
      React.createElement('div', { className: 'absolute top-0.5 right-0.5 ' + cornerClass + ' font-bold drop-shadow-lg ' + (isDamaged('topRight') ? 'text-red-400' : 'text-yellow-300') }, card.topRight),
      React.createElement('div', { className: 'absolute bottom-0.5 right-0.5 ' + cornerClass + ' font-bold drop-shadow-lg ' + (isDamaged('bottomRight') ? 'text-red-400' : 'text-yellow-300') }, card.bottomRight),
      React.createElement('div', { className: 'absolute bottom-0.5 left-0.5 ' + cornerClass + ' font-bold drop-shadow-lg ' + (isDamaged('bottomLeft') ? 'text-red-400' : 'text-yellow-300') }, card.bottomLeft),
      React.createElement('div', { className: 'text-white font-bold ' + totalClass + ' drop-shadow-lg' }, cardTotal)
    );
  };

  const getAnimationClass = (index) => {
    const animType = animatingCells[index];
    if (!animType) return '';
    
    if (animType === 'place') return 'animate-place';
    if (animType === 'move') return 'animate-move';
    if (animType === 'attack') return 'animate-attack';
    if (animType === 'destroy') return 'animate-destroy';
    return '';
  };

  if (gameMode === 'menu') {
    return (
      <div className="w-full h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800 rounded-xl p-8 shadow-2xl">
          <h1 className="text-3xl font-bold text-center text-white mb-8">Jeu de Cartes Tactique</h1>
          
          <div className="space-y-4">
            <button
              onClick={startLocalGame}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition transform hover:scale-105"
            >
              <Smartphone size={24} />
              <span>Partie Locale</span>
            </button>
            
            <button
              onClick={() => setGameMode('online-menu')}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition transform hover:scale-105"
            >
              <span>🌐</span>
              <span>Partie en Ligne</span>
            </button>
            
            <button
              onClick={() => setGameMode('rules')}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg transition transform hover:scale-105"
            >
              <BookOpen size={24} />
              <span>Règles du Jeu</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (gameMode === 'online-menu') {
    return (
      <div className="w-full h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800 rounded-xl p-8 shadow-2xl">
          <button
            onClick={() => { setGameMode('menu'); setOnlineError(''); }}
            className="flex items-center gap-2 mb-4 text-white hover:text-blue-400 transition"
          >
            <ArrowLeft size={20} />
            <span>Retour</span>
          </button>
          
          <h1 className="text-3xl font-bold text-center text-white mb-8">Partie en Ligne</h1>
          
          <div className="space-y-6">
            <button
              onClick={createOnlineGame}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition transform hover:scale-105"
            >
              <span>🎮</span>
              <span>Créer une Partie</span>
            </button>
            
            <div className="border-t border-slate-600 pt-6">
              <p className="text-white text-center mb-4">Ou rejoindre une partie</p>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="CODE (6 caractères)"
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.toUpperCase().substring(0, 6))}
                  maxLength={6}
                  className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border-2 border-slate-600 focus:border-purple-500 outline-none text-center text-2xl font-bold tracking-widest"
                />
                <button
                  onClick={joinOnlineGame}
                  disabled={inputCode.length !== 6}
                  className="w-full px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold rounded-lg transition"
                >
                  Rejoindre la Partie
                </button>
              </div>
            </div>
            
            {onlineError && (
              <div className="bg-red-900 border border-red-500 text-red-100 px-4 py-3 rounded text-center">
                {onlineError}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (gameMode === 'online' && isWaiting) {
    return (
      <div className="w-full h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800 rounded-xl p-8 shadow-2xl text-center">
          <h2 className="text-2xl font-bold text-white mb-4">En attente d'un adversaire...</h2>
          <p className="text-slate-300 mb-4">Partagez ce code avec votre adversaire :</p>
          
          <div className="bg-slate-900 rounded-lg p-6 mb-6">
            <div className="text-5xl font-bold text-green-400 tracking-widest mb-3">{roomCode}</div>
            <button
              onClick={copyRoomCode}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded transition"
            >
              📋 Copier le code
            </button>
          </div>
          
          <div className="animate-pulse flex justify-center mb-6">
            <div className="text-6xl">⏳</div>
          </div>
          
          <p className="text-slate-400 text-sm mb-6">{message}</p>
          
          <button
            onClick={() => {
              setGameMode('menu');
              setIsWaiting(false);
              setRoomCode('');
            }}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
          >
            Annuler
          </button>
        </div>
      </div>
    );
  }

  if (gameMode === 'rules') {
    return (
      <div className="w-full min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 overflow-auto p-4">
        <div className="max-w-2xl mx-auto bg-slate-800 rounded-xl p-6 shadow-2xl">
          <button
            onClick={() => setGameMode('menu')}
            className="flex items-center gap-2 mb-4 text-white hover:text-blue-400 transition"
          >
            <ArrowLeft size={20} />
            <span>Retour</span>
          </button>
          
          <h1 className="text-3xl font-bold text-white mb-6">Règles du Jeu</h1>
          
          <div className="space-y-4 text-white">
            <section>
              <h2 className="text-xl font-bold text-blue-400 mb-2">Objectif</h2>
              <p>Éliminez toutes les cartes adverses du plateau pour gagner.</p>
            </section>
            
            <section>
              <h2 className="text-xl font-bold text-blue-400 mb-2">Plateau</h2>
              <p>Grille 5×5 avec coins inaccessibles. Joueur 1 en haut, Joueur 2 en bas.</p>
            </section>
            
            <section>
              <h2 className="text-xl font-bold text-blue-400 mb-2">Les Cartes</h2>
              <p>8 valeurs (4 côtés + 4 angles) de 0 à 9. Total du deck : 100 points.</p>
            </section>
            
            <section>
              <h2 className="text-xl font-bold text-blue-400 mb-2">Actions par Tour</h2>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Placer 1 carte dans votre zone</li>
                <li>Déplacer 2 fois (diagonal autorisé)</li>
                <li>Attaquer 1 fois (adjacent cardinal)</li>
              </ul>
            </section>
            
            <section>
              <h2 className="text-xl font-bold text-blue-400 mb-2">Combat</h2>
              <p>Les valeurs qui se touchent perdent 1 point. Si -1, carte détruite.</p>
            </section>
          </div>
        </div>
      </div>
    );
  }

  const player1Active = currentPlayer === 1;
  const player2Active = currentPlayer === 2;
  
  if (gameOver) {
    return (
      <div className="w-full h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800 rounded-xl p-8 shadow-2xl text-center">
          <h1 className="text-4xl font-bold text-white mb-4">🎉 Partie terminée ! 🎉</h1>
          <div className="my-8">
            <div className={winner === 1 ? 'text-6xl font-bold text-blue-400 mb-4' : 'text-6xl font-bold text-red-400 mb-4'}>
              Joueur {winner} gagne !
            </div>
            <p className="text-slate-300 text-lg">Félicitations !</p>
          </div>
          <div className="space-y-3">
            <button
              onClick={() => {
                setGameOver(false);
                setWinner(null);
                startLocalGame();
              }}
              className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition transform hover:scale-105"
            >
              Rejouer
            </button>
            <button
              onClick={() => {
                setGameOver(false);
                setWinner(null);
                setGameMode('menu');
              }}
              className="w-full px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg transition transform hover:scale-105"
            >
              Menu Principal
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="w-full bg-gradient-to-br from-slate-900 to-slate-800 p-4" style={{ height: '100vh', maxHeight: '100vh', overflow: 'hidden' }}>
      <audio id="game-music" loop preload="auto">
        <source src="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" type="audio/mpeg" />
      </audio>
      <style>{`
        @keyframes place {
          0% { transform: scale(0) rotate(0deg); opacity: 0; }
          50% { transform: scale(1.2) rotate(180deg); opacity: 1; }
          100% { transform: scale(1) rotate(360deg); opacity: 1; }
        }
        @keyframes move {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-20px); }
        }
        @keyframes attack {
          0%, 100% { transform: scale(1); }
          25% { transform: scale(1.15) rotate(-5deg); }
          75% { transform: scale(1.15) rotate(5deg); }
        }
        @keyframes destroy {
          0% { 
            transform: scale(1) rotate(0deg); 
            opacity: 1;
            filter: brightness(1);
          }
          20% {
            transform: scale(1.3) rotate(20deg);
            opacity: 1;
            filter: brightness(2) hue-rotate(45deg);
          }
          40% {
            transform: scale(1.2) rotate(-20deg);
            opacity: 0.9;
            filter: brightness(3) hue-rotate(90deg);
          }
          60% {
            transform: scale(1.4) rotate(45deg);
            opacity: 0.7;
            filter: brightness(2) blur(2px);
          }
          80% {
            transform: scale(0.8) rotate(180deg);
            opacity: 0.4;
            filter: blur(5px);
          }
          100% { 
            transform: scale(0) rotate(720deg); 
            opacity: 0;
            filter: blur(10px);
          }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
          20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
        @keyframes explosion {
          0% {
            box-shadow: 0 0 0 0 rgba(255, 100, 0, 0.7);
          }
          50% {
            box-shadow: 0 0 30px 20px rgba(255, 100, 0, 0.5);
          }
          100% {
            box-shadow: 0 0 60px 40px rgba(255, 100, 0, 0);
          }
        }
        @keyframes flash {
          0%, 100% { background-color: transparent; }
          50% { background-color: rgba(255, 255, 255, 0.8); }
        }
        .animate-place { animation: place 0.6s ease-out; }
        .animate-move { animation: move 0.6s ease-in-out; }
        .animate-attack { animation: attack 0.6s ease-in-out; }
        .animate-destroy { 
          animation: destroy 1.2s ease-in-out forwards, explosion 1.2s ease-out, shake 0.3s ease-in-out 3;
          z-index: 100;
        }
      `}</style>
      
      <div className="h-full flex flex-col gap-3" style={{ maxHeight: 'calc(100vh - 32px)' }}>
        <div className="flex items-center justify-between" style={{ flexShrink: 0, position: 'relative', zIndex: 1000 }}>
          <button
            onClick={() => setGameMode('menu')}
            className="flex items-center gap-2 text-white hover:text-blue-400 transition"
          >
            <ArrowLeft size={20} />
            <span>Menu</span>
          </button>
          <h1 className="text-2xl font-bold text-white">Jeu de Cartes Tactique</h1>
          <button
            onClick={toggleMusic}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded transition"
            style={{ minWidth: '100px', position: 'relative', zIndex: 1001 }}
            type="button"
          >
            {isMusicPlaying ? '🔊 ON' : '🔇 OFF'}
          </button>
        </div>

        <div className="flex gap-4 items-center" style={{ flexGrow: 1 }}>
          <div className="bg-slate-800 rounded-lg p-3 h-full flex flex-col" style={{ width: '140px', flexShrink: 0 }}>
            <div className="flex items-center gap-2 mb-3">
              <div className={player1Active ? 'w-3 h-3 rounded-full bg-green-500 animate-pulse' : 'w-3 h-3 rounded-full bg-gray-500'}></div>
              <span className="text-white text-sm font-bold">J1</span>
            </div>
            <div className="text-white text-xs mb-2">Total: {calculateDeckTotal(player1Hand) + calculateBoardTotal(1)} pts</div>
            <div className="flex-1 flex flex-col gap-2 overflow-y-auto">
              {player1Hand.map((card, idx) => (
                <div 
                  key={card.id}
                  draggable={player1Active}
                  onDragStart={(e) => player1Active && handleDragStart(e, 'hand', idx)}
                  className={player1Active ? 'cursor-grab active:cursor-grabbing hover:scale-105 transform transition' : 'opacity-50 transform transition'}
                  style={{ width: '100px', height: '100px' }}
                >
                  <CardDisplay card={card} small={true} owner={1} />
                </div>
              ))}
            </div>
            {player1Active && (
              <button
                onClick={endTurn}
                className="mt-3 flex items-center justify-center gap-2 px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-lg transition whitespace-nowrap"
              >
                <SkipForward size={16} />
                <span>Fin du tour</span>
              </button>
            )}
          </div>

          <div className="flex-1 flex flex-col gap-3 h-full">
            <div className="flex-1 bg-slate-700 rounded-lg p-3 flex items-center justify-center">
              <div className="grid grid-cols-5 gap-2" style={{ width: '500px', height: '500px' }}>
                {board.map((cell, idx) => {
                  if (isCorner(idx)) {
                    return <div key={idx} className="aspect-square bg-slate-900 rounded opacity-30"></div>;
                  }

                  const isPlayerZone1 = isPlayerZone(idx, 1);
                  const isPlayerZone2 = isPlayerZone(idx, 2);
                  const isDragOver = dragOverCell === idx;

                  let cellClass = 'aspect-square rounded-lg border-2 transition ';
                  if (cell) {
                    cellClass += cell.owner === 1 ? 'bg-blue-900 border-blue-400 ' : 'bg-red-900 border-red-400 ';
                  } else if (isPlayerZone1) {
                    cellClass += 'bg-blue-800 border-blue-600 opacity-50 ';
                  } else if (isPlayerZone2) {
                    cellClass += 'bg-red-800 border-red-600 opacity-50 ';
                  } else {
                    cellClass += 'bg-slate-600 border-slate-500 ';
                  }
                  if (isDragOver) cellClass += 'ring-4 ring-yellow-400 scale-105';

                  return (
                    <div
                      key={idx}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, idx)}
                      className={cellClass}
                    >
                      {cell && (
                        <div
                          draggable
                          onDragStart={(e) => handleDragStart(e, 'board', idx)}
                          className={'cursor-grab active:cursor-grabbing w-full h-full ' + getAnimationClass(idx)}
                        >
                          <CardDisplay card={cell} cellIndex={idx} owner={cell.owner} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-slate-700 rounded-lg p-2" style={{ flexShrink: 0 }}>
              <p className="text-white text-sm font-semibold text-center">{message}</p>
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg p-3 h-full flex flex-col" style={{ width: '140px', flexShrink: 0 }}>
            <div className="flex items-center gap-2 mb-3">
              <div className={player2Active ? 'w-3 h-3 rounded-full bg-green-500 animate-pulse' : 'w-3 h-3 rounded-full bg-gray-500'}></div>
              <span className="text-white text-sm font-bold">J2</span>
            </div>
            <div className="text-white text-xs mb-2">Total: {calculateDeckTotal(player2Hand) + calculateBoardTotal(2)} pts</div>
            <div className="flex-1 flex flex-col gap-2 overflow-y-auto">
              {player2Hand.map((card, idx) => (
                <div 
                  key={card.id}
                  draggable={player2Active}
                  onDragStart={(e) => player2Active && handleDragStart(e, 'hand', idx)}
                  className={player2Active ? 'cursor-grab active:cursor-grabbing hover:scale-105 transform transition' : 'opacity-50 transform transition'}
                  style={{ width: '100px', height: '100px' }}
                >
                  <CardDisplay card={card} small={true} owner={2} />
                </div>
              ))}
            </div>
            {player2Active && (
              <button
                onClick={endTurn}
                className="mt-3 flex items-center justify-center gap-2 px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-lg transition whitespace-nowrap"
              >
                <SkipForward size={16} />
                <span>Fin du tour</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TacticalCardGame;
