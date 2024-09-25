import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid'; // Utilisation de uuid pour des identifiants de jeu uniques

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const games = {}; // Stockage des jeux
const MIN_PLAYERS = 9; // Nombre minimum de joueurs requis pour commencer le jeu

// Classe Game pour gérer les jeux
class Game {
    constructor(id, creatorId, creatorName) {
        this.id = id;
        this.players = []; // Liste des joueurs
        this.creatorId = creatorId; // ID du créateur
        this.creatorName = creatorName; // Nom du créateur
        this.rolesAssigned = false; // Indicateur pour vérifier si les rôles sont attribués
    }
}

// Fonction pour supprimer un jeu
const deleteGame = (gameId) => {
    if (games[gameId]) {
        delete games[gameId]; // Supprime le jeu de l'objet
        return true;
    }
    return false;
};

// Fonction pour attribuer les rôles
const assignRoles = (gameId, playersNames) => {
    const game = games[gameId];
    const numberOfWerewolves = Math.floor(game.players.length / 4);
    const essentialRoles = ['Corbeau', 'Salvateur', 'Voyante', 'Sorcière', 'Ancien', 'Chasseur', 'Villageois'];
    const roles = [
        ...Array(numberOfWerewolves).fill('Loup-garou'), // Ajoute des loups-garous
        ...essentialRoles
    ];

    // Attribuer des rôles aux joueurs
    playersNames.forEach((playerName, index) => {
        const player = game.players.find(p => p.name === playerName);
        if (player) {
            player.role = roles[index % roles.length]; // Cycler à travers les rôles
            console.log(`Joueur : ${player.name}, Rôle : ${player.role}`); // Journaliser l'attribution de rôle
        }
    });

    game.rolesAssigned = true; // Marquer les rôles comme attribués

    // Informer chaque joueur de son rôle attribué
    game.players.forEach(player => {
        io.to(player.id).emit('roleAssigned', { name: player.name, role: player.role });
    });

    // Informer le créateur sur l'attribution des rôles
    io.to(game.creatorId).emit('rolesAssignedToPlayers', game.players.map(p => ({ name: p.name, role: p.role })));
};

// Gestion des connexions Socket
io.on('connection', (socket) => {
    console.log('Un joueur est connecté :', socket.id);

    // Événement pour créer un nouveau jeu
    socket.on('createGame', async (name, callback) => {
        const gameId = uuidv4(); // Utiliser uuid pour garantir des identifiants de jeu uniques
        const newGame = new Game(gameId, socket.id, name); // Stocker l'ID et le nom du créateur

        // Ajouter le joueur au nouveau jeu
        newGame.players.push({ id: socket.id, name });

        // Stocker le jeu dans l'objet des jeux
        games[gameId] = newGame;

        // Informer le client de la création du jeu
        socket.emit('gameCreated', gameId);

        // Obtenir l'adresse IP publique
        try {
            const { data } = await axios.get('https://api.ipify.org?format=json');
            console.log(`IP publique du créateur : ${data.ip}`);

            // Envoyer l'adresse IP publique au client
            callback({ success: true, message: "Jeu créé avec succès !", publicAddress: data.ip });

            // Informer tous les clients des jeux disponibles
            io.emit('availableGames', Object.values(games).map(game => ({
                id: game.id,
                creator: game.creatorName, // Inclure le nom du créateur
            })));

            console.log(`Jeu créé avec l'ID : ${gameId}`);
        } catch (error) {
            callback({ success: false, message: 'Erreur lors de la récupération de l\'adresse IP.' });
        }
    });

    // Événement pour rejoindre un jeu
    socket.on('joinGame', (data, callback) => {
        const { name, gameId } = data;
        const game = games[gameId];

        if (!game) {
            callback({ success: false, message: "Jeu non trouvé." });
            return;
        }

        // Vérifier si le joueur est déjà dans le jeu
        const existingPlayer = game.players.find(player => player.id === socket.id);
        if (existingPlayer) {
            callback({ success: false, message: "Vous êtes déjà dans ce jeu." });
            return;
        }

        // Ajouter le joueur au jeu
        game.players.push({ id: socket.id, name });

        // Informer le joueur
        socket.join(gameId);
        console.log(`${name} a rejoint le jeu ${gameId}`);

        // Envoyer les joueurs actuels à tous les clients dans le jeu
        io.to(gameId).emit('players', game.players);

        // Notifier le créateur que le joueur a rejoint
        io.to(game.creatorId).emit('playerJoined', { name, playerCount: game.players.length });

        // Vérifier si le jeu peut commencer
        if (game.players.length >= MIN_PLAYERS) {
            // Attribuer automatiquement des rôles lorsque le nombre minimum de joueurs est atteint
            const playersNames = game.players.map(player => player.name);
            io.to(gameId).emit('startGame', { message: "Le jeu commence !", players: playersNames });
            assignRoles(gameId, playersNames); // Appeler la fonction pour attribuer des rôles aux joueurs
        }

        // Informer tous les clients des jeux disponibles après que le joueur a rejoint
        io.emit('availableGames', Object.values(games).map(game => ({
            id: game.id,
            creator: game.creatorName,
        })));

        // Envoyer une réponse au client
        callback({ success: true });
    });

    // Événement pour supprimer un jeu
    socket.on('deleteGame', (gameId) => {
        const success = deleteGame(gameId); // Supprimer le jeu de l'objet
        if (success) {
            io.emit('gameDeleted', gameId); // Informer tous les clients que le jeu a été supprimé
            console.log(`Jeu avec l'ID ${gameId} supprimé.`);
        } else {
            socket.emit('error', { message: 'Erreur lors de la suppression du jeu. Jeu non trouvé.' });
        }
    });

    // Gérer la déconnexion du joueur
    socket.on('disconnect', () => {
        console.log('Un joueur s\'est déconnecté :', socket.id);

        // Gérer la déconnexion du créateur
        for (const gameId in games) {
            const game = games[gameId];
            game.players = game.players.filter(player => player.id !== socket.id); // Supprimer le joueur du jeu
            if (game.players.length === 0 || game.creatorId === socket.id) {
                deleteGame(gameId); // Si aucun joueur n'est resté ou si le créateur se déconnecte, supprimer le jeu
                io.emit('gameDeleted', gameId); // Informer tous les clients que le jeu a été supprimé
                console.log(`Jeu avec l'ID ${gameId} supprimé.`);
            } else {
                io.to(gameId).emit('players', game.players); // Informer les joueurs restants
            }
        }
    });
});

// Démarrer le serveur
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Serveur à l'écoute sur le port ${PORT}`);
});
