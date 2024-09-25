import React, { useState } from 'react';
import { View, TextInput, Text, Alert, StyleSheet, TouchableOpacity, ImageBackground } from 'react-native';

const HomeScreen = ({ navigation }) => {
  const [name, setName] = useState('');

  const handleStartGame = () => {
    if (!name.trim()) {
      Alert.alert('Erreur', 'Le nom ne peut pas être vide');
      return;
    }
    navigation.navigate('Game', { playerName: name });
  };

  return (
    <ImageBackground source={require('./assets/moon_background.jpg')} style={styles.background}>
      <View style={styles.container}>
        <Text style={styles.title}>Bienvenue</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Entrez votre nom"
          placeholderTextColor="#CCC"
          style={styles.input}
        />
        <TouchableOpacity style={styles.button} onPress={handleStartGame}>
          <Text style={styles.buttonText}>Commencer le jeu</Text>
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
    resizeMode: 'cover',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)', // Assombrir l'arrière-plan
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 40,
    textShadowColor: '#000',
    textShadowRadius: 10,
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#774C4C',
    padding: 15,
    marginBottom: 20,
    borderRadius: 10,
    color: '#FFF',
    backgroundColor: '#333',
    fontSize: 18,
  },
  button: {
    backgroundColor: '#8B0000',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 10,
  },
  buttonText: {
    color: '#FFD700',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default HomeScreen;
