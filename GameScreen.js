import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, Alert, StyleSheet, ImageBackground, Image, ActivityIndicator, Animated, TouchableOpacity } from 'react-native';
import io from 'socket.io-client';

const socket = io('http://192.168.1.7:3000'); // Remplacez par l'adresse IP de votre serveur

const rolesEssentiels = ['Corbeau', 'Salvateur', 'Loup-garou', 'Voyante', 'Sorcière', 'Ancien', 'Chasseur', 'Villageois'];

export default function GameScreen({ route }) {
  const { playerName } = route.params;
  const [players, setPlayers] = useState([]);
  const [availableGames, setAvailableGames] = useState([]);
  const [role, setRole] = useState('');
  const [connected, setConnected] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [currentPhase, setCurrentPhase] = useState('day');
  const [showPlayers, setShowPlayers] = useState(false);
  const [alive, setAlive] = useState(true);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [showAvailableGames, setShowAvailableGames] = useState(false);
  const [loading, setLoading] = useState(false);
  const fadeAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    socket.on('players', (players) => {
      setPlayers(players);
    });

    socket.on('availableGames', (games) => {
      setAvailableGames(games);
    });

    socket.on('rolesAssignedToPlayers', (playersWithRoles) => {
      setPlayers(playersWithRoles);
      const me = playersWithRoles.find(p => p.name === playerName);
      if (me) setRole(me.role);
    });

    socket.on('nightPhase', () => setCurrentPhase('night'));
    socket.on('dayPhase', () => setCurrentPhase('day'));

    socket.on('eliminated', (eliminatedPlayerName) => {
      if (eliminatedPlayerName === playerName) {
        setAlive(false);
        Alert.alert('Tu es mort(e) !', 'Malheureusement, tu as été éliminé(e) du jeu.');
      }
    });

    socket.emit('requestAvailableGames');

    return () => {
      socket.off('players');
      socket.off('availableGames');
      socket.off('rolesAssignedToPlayers');
      socket.off('nightPhase');
      socket.off('dayPhase');
      socket.off('eliminated');
    };
  }, [playerName, isHost]);
  useEffect(() => {
    // Autres écouteurs...
  
    socket.on('roleAssignedToPlayer', ({ playerName, role }) => {
      if (playerName === playerName) {
        setRole(role); // Met à jour le rôle du joueur
      }
    });
  
    return () => {
      // Désabonnez-vous des événements ici
      socket.off('roleAssignedToPlayer');
    };
  }, [playerName]);
  
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [showPlayers, showAvailableGames]);

  const joinGame = (gameId) => {
    if (!playerName.trim()) {
      Alert.alert('Erreur', 'Le nom ne peut pas être vide');
      return;
    }
    setLoading(true);
    socket.emit('joinGame', { name: playerName, gameId }, (response) => {
      setLoading(false);
      if (response.success) {
        setConnected(true);
        setShowAvailableGames(false);
        socket.emit('getPlayers', gameId, (players) => {
          setPlayers(players);
        });
      } else {
        Alert.alert('Erreur', response.message);
      }
    });
  };

  const createGame = () => {
    if (!playerName.trim()) {
      Alert.alert('Erreur', 'Le nom ne peut pas être vide');
      return;
    }
    setLoading(true);
    socket.emit('createGame', playerName, (response) => {
      setLoading(false);
      if (response.success) {
        setIsHost(true);
        setConnected(true);

        const initialPlayers = [{ name: playerName, alive: true }];
        for (let i = 1; i <= 8; i++) {
          initialPlayers.push({ name: `Joueur ${i}`, alive: true });
        }
        setPlayers(initialPlayers);
        socket.emit('updatePlayers', initialPlayers);

        assignRoles();
      } else {
        Alert.alert('Erreur', response.message);
      }
    });
  };

  const assignRoles = () => {
    if (!isHost) return; // Only the host can assign roles
  
    // Calculer le nombre de loups-garous : 1 loup-garou pour chaque 4 joueurs
    const numberOfWerewolves = Math.floor(players.length / 4);
    console.log(`Number of Werewolves: ${numberOfWerewolves}`);
  
    // Rôles essentiels (sans les loups-garous)
    const rolesToAssign = [...rolesEssentiels];
    
    // Ajouter les loups-garous à la liste des rôles à assigner
    for (let i = 0; i < numberOfWerewolves; i++) {
      rolesToAssign.push('Loup-garou');
    }
  
    // Mélanger les rôles
    const shuffledRoles = rolesToAssign.sort(() => 0.5 - Math.random());
  
    // Assigner les rôles aux joueurs
    const playersWithRoles = players.map((player, index) => ({
      ...player,
      role: shuffledRoles[index % shuffledRoles.length], // Assigne un rôle à chaque joueur
    }));
  
    setPlayers(playersWithRoles); // Met à jour la liste des joueurs avec les rôles
    socket.emit('rolesAssignedToPlayers', playersWithRoles); // Envoie les rôles au serveur
  
    // Émettez chaque rôle individuel pour chaque joueur
    playersWithRoles.forEach(player => {
      socket.emit('roleAssignedToPlayer', { playerName: player.name, role: player.role });
    });
  };
  

  const nightAction = (actionType) => {
    if (selectedTarget) {
      socket.emit('nightAction', { actionType, target: selectedTarget });
      setSelectedTarget(null);
    } else {
      Alert.alert('Erreur', 'Tu dois choisir une cible.');
    }
  };

  const handlePlayerPress = (playerName) => {
    if (currentPhase === 'night' && role === 'Loup-garou') {
      setSelectedTarget(playerName);
      Alert.alert('Cible choisie', `Tu as choisi ${playerName} comme cible.`);
    }
  };

  const playerStyle = (isAlive) => ({
    fontSize: 18,
    color: isAlive ? '#FFF' : '#FF4500',
    paddingVertical: 10,
    textAlign: 'center',
    textShadowColor: '#000',
    textShadowRadius: 4,
  });

  const deleteGame = (event, gameId) => {
    event.persist();
    Alert.alert(
      'Supprimer la partie',
      'Es-tu sûr de vouloir supprimer cette partie ?',
      [
        {
          text: 'Annuler',
          style: 'cancel',
        },
        {
          text: 'Supprimer',
          onPress: () => {
            socket.emit('deleteGame', gameId, (response) => {
              if (response.success) {
                Alert.alert('Partie supprimée', 'La partie a été supprimée avec succès.');
                setConnected(false);
                setIsHost(false);
                setPlayers([]);
              } else {
                Alert.alert('Erreur', response.message);
              }
            });
          },
        },
      ],
    );
  };

  return (
    <ImageBackground source={require('./assets/moon_background.jpg')} style={styles.background}>
      <View style={styles.container}>
        <Image source={require('./assets/werewolf_logo.png')} style={styles.logo} />

        {loading ? (
          <ActivityIndicator size="large" color="#FFD700" />
        ) : !connected ? (
          <View style={styles.joinContainer}>
            <TouchableOpacity style={styles.button} onPress={createGame}>
              <Text style={styles.buttonText}>Créer une partie</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={() => setShowAvailableGames(true)}>
              <Text style={styles.buttonText}>Rejoindre une partie</Text>
            </TouchableOpacity>

            {showAvailableGames && (
              <Animated.View style={[styles.availableGamesContainer, { opacity: fadeAnim }]}>
                <Text style={styles.subTitle}>Parties disponibles :</Text>
                <FlatList
                  data={availableGames}
                  keyExtractor={(item) => item.id.toString()}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.button}
                      onPress={() => joinGame(item.id)}
                    >
                      <Text style={styles.buttonText}>Rejoindre {item.name} (Créé par: {item.creator})</Text>
                    </TouchableOpacity>
                  )}
                  style={styles.scrollableContainer}
                />
              </Animated.View>
            )}
          </View>
        ) : (
          <View style={styles.gameContainer}>
            {alive ? (
              <View>
                <TouchableOpacity style={styles.button} onPress={() => setShowPlayers(!showPlayers)}>
                  <Text style={styles.buttonText}>{showPlayers ? 'Cacher les joueurs' : 'Afficher les joueurs'}</Text>
                </TouchableOpacity>
                {showPlayers && (
                  <Animated.View style={[styles.playerList, { opacity: fadeAnim }]}>
                    <Text style={styles.subTitle}>Joueurs connectés :</Text>
                    <FlatList
                      data={players}
                      renderItem={({ item }) => (
                        <Text
                          style={playerStyle(item.alive)}
                          onPress={() => handlePlayerPress(item.name)}
                        >
                          {item.name} {isHost && `- ${item.role}`} {item.alive ? '' : '(Éliminé)'}
                        </Text>
                      )}
                      keyExtractor={(item) => item.name}
                    />
                  </Animated.View>
                )}
                <Text style={styles.subTitle}>Phase actuelle : {currentPhase}</Text>
                {!isHost && (
                  <Text style={styles.subTitle}>Rôle : {role}</Text>
                )}

                {isHost && (
                  <TouchableOpacity style={styles.button} onPress={assignRoles}>
                    <Text style={styles.buttonText}>Distribuer les rôles</Text>
                  </TouchableOpacity>
                )}

                {currentPhase === 'night' && role === 'Loup-garou' && (
                  <View>
                    <Text style={styles.subTitle}>Choisis une cible :</Text>
                    <TouchableOpacity style={styles.button} onPress={() => nightAction('kill')}>
                      <Text style={styles.buttonText}>Tuer</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.button} onPress={() => nightAction('save')}>
                      <Text style={styles.buttonText}>Sauver</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ) : (
              <Text style={styles.gameOverText}>Tu es mort(e) !</Text>
            )}
          </View>
        )}
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  logo: {
    width: 200,
    height: 200,
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#FFD700',
    padding: 15,
    borderRadius: 5,
    marginBottom: 10,
  },
  buttonText: {
    color: '#000',
    fontSize: 16,
    textAlign: 'center',
  },
  joinContainer: {
    alignItems: 'center',
  },
  availableGamesContainer: {
    marginTop: 20,
    width: '100%',
  },
  subTitle: {
    fontSize: 18,
    color: '#FFF',
    marginVertical: 10,
    textAlign: 'center',
  },
  playerList: {
    marginTop: 10,
  },
  scrollableContainer: {
    maxHeight: 200,
    width: '100%',
  },
  gameContainer: {
    alignItems: 'center',
    width: '100%',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  gameOverText: {
    fontSize: 24,
    color: '#FF4500',
    textAlign: 'center',
  },
});
