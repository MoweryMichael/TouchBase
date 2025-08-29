// First, we need to install navigation packages
// Run this in your terminal:
// npm install @react-navigation/native @react-navigation/stack
// npx expo install react-native-screens react-native-safe-area-context

import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Alert 
} from 'react-native';
import { auth } from './firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut,
  updateProfile 
} from 'firebase/auth';
import { createCommunity, generateInviteCode, joinCommunity, getUserCommunities, addMockMembers, getCommunityMembers, getMockMemberName, createGame } from './communityService';

// Create the navigation stack
const Stack = createStackNavigator();

// Login Screen Component
function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

const handleLogin = async () => {
  if (!email || !password) {
    Alert.alert('Error', 'Please enter both email and password');
    return;
  }
  
  try {
    await signInWithEmailAndPassword(auth, email, password);
    navigation.navigate('Home');
  } catch (error) {
    Alert.alert('Login Failed', error.message);
  }
};

  const goToSignup = () => {
    navigation.navigate('Signup');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>TouchBase</Text>
      <Text style={styles.subtitle}>Connect with your community</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry={true}
      />

      <TouchableOpacity style={styles.button} onPress={handleLogin}>
        <Text style={styles.buttonText}>Login</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.linkContainer} onPress={goToSignup}>
        <Text style={styles.linkText}>Don't have an account? Sign Up</Text>
      </TouchableOpacity>
    </View>
  );
}

// Signup Screen Component
function SignupScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

const handleSignup = async () => {
  if (!email || !password || !confirmPassword || !displayName) {
    Alert.alert('Error', 'Please fill in all fields');
    return;
  }
  
  if (password !== confirmPassword) {
    Alert.alert('Error', 'Passwords do not match');
    return;
  }
  
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(userCredential.user, { displayName: displayName });
    Alert.alert('Success', 'Account created! Welcome to TouchBase!', [
      { text: 'OK', onPress: () => navigation.navigate('Home') }
    ]);
  } catch (error) {
    Alert.alert('Signup Failed', error.message);
  }
};

  const goToLogin = () => {
    navigation.navigate('Login');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Join TouchBase</Text>
      <Text style={styles.subtitle}>Create your account</Text>

      <TextInput
        style={styles.input}
        placeholder="Display Name"
        value={displayName}
        onChangeText={setDisplayName}
      />

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry={true}
      />

      <TextInput
        style={styles.input}
        placeholder="Confirm Password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry={true}
      />

      <TouchableOpacity style={styles.button} onPress={handleSignup}>
        <Text style={styles.buttonText}>Create Account</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.linkContainer} onPress={goToLogin}>
        <Text style={styles.linkText}>Already have an account? Login</Text>
      </TouchableOpacity>
    </View>
  );
}

// Home Screen Component (what users see after logging in)
function HomeScreen({ navigation }) {
  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', onPress: () => navigation.navigate('Login') }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to TouchBase!</Text>
      <Text style={styles.subtitle}>Your communities will appear here</Text>
      
      <View style={styles.homeContent}>
        <Text style={styles.homeText}>🎉 You're logged in!</Text>
        <Text style={styles.homeText}>Soon you'll see:</Text>
        <Text style={styles.listItem}>• Your communities</Text>
        <Text style={styles.listItem}>• Active games</Text>
        <Text style={styles.listItem}>• Pending consequences</Text>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.buttonText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

// Community List Screen - shows user's communities
function CommunityListScreen({ navigation }) {
  const [communities, setCommunities] = useState([]);

  React.useEffect(() => {
    loadCommunities();
  }, []);

  const loadCommunities = async () => {
    try {
      const userCommunities = await getUserCommunities();
      setCommunities(userCommunities);
    } catch (error) {
      Alert.alert('Error', 'Failed to load communities');
    }
  };

  const goToCreateCommunity = () => {
    navigation.navigate('CreateCommunity');
  };

  const goToJoinCommunity = () => {
    navigation.navigate('JoinCommunity');
  };

  const goToGameList = () => {
    navigation.navigate('GameList');
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', onPress: async () => {
          await signOut(auth);
          navigation.navigate('Login');
        }}
      ]
    );
  };

  const addTestMembers = async (communityId) => {
    try {
      await addMockMembers(communityId);
      Alert.alert('Success', 'Added 4 test members to community');
      loadCommunities(); // Refresh the display
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Communities</Text>
      <Text style={styles.subtitle}>Manage communities and start games</Text>

      {communities.map(community => (
        <View key={community.id} style={styles.communityCard}>
          <Text style={styles.communityName}>{community.name}</Text>
          <Text style={styles.memberCount}>{community.members.length} members</Text>
          <Text style={styles.inviteCode}>Code: {community.inviteCode}</Text>
          <TouchableOpacity 
            style={styles.smallButton} 
            onPress={() => addTestMembers(community.id)}
          >
            <Text style={styles.smallButtonText}>Add Test Members</Text>
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity style={styles.button} onPress={goToGameList}>
        <Text style={styles.buttonText}>Start New Game</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={goToCreateCommunity}>
        <Text style={styles.buttonText}>Create Community</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, styles.tertiaryButton]} onPress={goToJoinCommunity}>
        <Text style={styles.buttonText}>Join Community</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.buttonText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

// Create Community Screen
function CreateCommunityScreen({ navigation }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a community name');
      return;
    }

    try {
      const community = await createCommunity(name.trim(), description.trim());
      Alert.alert(
        'Success!', 
        `Community created! Share invite code: ${community.inviteCode}`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Community</Text>
      <Text style={styles.subtitle}>Start your TouchBase community</Text>

      <TextInput
        style={styles.input}
        placeholder="Community Name (e.g., College Friends)"
        value={name}
        onChangeText={setName}
        maxLength={50}
      />

      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Description (optional)"
        value={description}
        onChangeText={setDescription}
        multiline={true}
        numberOfLines={3}
        maxLength={200}
      />

      <TouchableOpacity style={styles.button} onPress={handleCreate}>
        <Text style={styles.buttonText}>Create Community</Text>
      </TouchableOpacity>
    </View>
  );
}

// Join Community Screen
function JoinCommunityScreen({ navigation }) {
  const [inviteCode, setInviteCode] = useState('');

  const handleJoin = async () => {
    if (!inviteCode.trim()) {
      Alert.alert('Error', 'Please enter an invite code');
      return;
    }

    try {
      const community = await joinCommunity(inviteCode.trim());
      Alert.alert(
        'Success!', 
        `Joined "${community.name}" community!`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Join Community</Text>
      <Text style={styles.subtitle}>Enter an invite code to join</Text>

      <TextInput
        style={styles.input}
        placeholder="Invite Code (e.g., SEDKFXI)"
        value={inviteCode}
        onChangeText={setInviteCode}
        autoCapitalize="characters"
        maxLength={7}
      />

      <TouchableOpacity style={styles.button} onPress={handleJoin}>
        <Text style={styles.buttonText}>Join Community</Text>
      </TouchableOpacity>
    </View>
  );
}

// Game List Screen - shows available opponents
function GameListScreen({ navigation }) {
  const [communities, setCommunities] = useState([]);
  const [selectedCommunity, setSelectedCommunity] = useState(null);
  const [availableOpponents, setAvailableOpponents] = useState([]);

  React.useEffect(() => {
    loadCommunities();
  }, []);

  const loadCommunities = async () => {
    try {
      const userCommunities = await getUserCommunities();
      setCommunities(userCommunities);
    } catch (error) {
      Alert.alert('Error', 'Failed to load communities');
    }
  };

  const selectCommunity = async (community) => {
    try {
      const result = await getCommunityMembers(community.id);
      setSelectedCommunity(community);
      setAvailableOpponents(result.availableOpponents);
    } catch (error) {
      Alert.alert('Error', 'Failed to load community members');
    }
  };

  const createGameWithOpponent = (opponentId) => {
    const opponentName = getMockMemberName(opponentId);
    Alert.alert(
      'Create Game',
      `Start TouchBase game with ${opponentName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Start Game', onPress: () => handleCreateGame(selectedCommunity.id, opponentId) }
      ]
    );
  };

  const handleCreateGame = async (communityId, opponentId) => {
    try {
      const game = await createGame(communityId, opponentId);
      Alert.alert('Game Created!', 'Ready to start guessing', [
        { text: 'OK', onPress: () => navigation.navigate('Home') }
      ]);
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  if (selectedCommunity) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{selectedCommunity.name}</Text>
        <Text style={styles.subtitle}>Choose your opponent</Text>

        {availableOpponents.map(opponentId => (
          <TouchableOpacity 
            key={opponentId}
            style={styles.opponentCard}
            onPress={() => createGameWithOpponent(opponentId)}
          >
            <Text style={styles.opponentName}>{getMockMemberName(opponentId)}</Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => setSelectedCommunity(null)}
        >
          <Text style={styles.buttonText}>Back to Communities</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Start New Game</Text>
      <Text style={styles.subtitle}>Choose a community</Text>

      {communities.map(community => (
        <TouchableOpacity 
          key={community.id} 
          style={styles.communityCard}
          onPress={() => selectCommunity(community)}
        >
          <Text style={styles.communityName}>{community.name}</Text>
          <Text style={styles.memberCount}>{community.members.length} members</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// Main App Component with Navigation
export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName="Login"
        screenOptions={{
          headerStyle: { backgroundColor: '#007AFF' },
          headerTintColor: 'white',
          headerTitleStyle: { fontWeight: 'bold' }
        }}
      >
        <Stack.Screen 
          name="Login" 
          component={LoginScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name="Signup" 
          component={SignupScreen}
          options={{ title: 'Create Account' }}
        />
        <Stack.Screen 
          name="Home" 
          component={CommunityListScreen}
          options={{ 
            title: 'TouchBase Communities',
            headerLeft: null
          }}
        />
        <Stack.Screen 
          name="CreateCommunity" 
          component={CreateCommunityScreen}
          options={{ title: 'Create Community' }}
        />
        <Stack.Screen 
          name="JoinCommunity" 
          component={JoinCommunityScreen}
          options={{ title: 'Join Community' }}
        />
        <Stack.Screen 
          name="GameList" 
          component={GameListScreen}
          options={{ title: 'Start New Game' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// Styles (same as before, plus some new ones)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 40,
  },
  input: {
    width: '100%',
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  button: {
    width: '100%',
    height: 50,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  linkContainer: {
    marginTop: 10,
  },
  linkText: {
    color: '#007AFF',
    fontSize: 16,
  },
  homeContent: {
    alignItems: 'center',
    marginBottom: 40,
  },
  homeText: {
    fontSize: 18,
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  listItem: {
    fontSize: 16,
    color: '#666',
    marginBottom: 5,
  },
  logoutButton: {
    width: '100%',
    height: 50,
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textArea: {
  height: 80,
  textAlignVertical: 'top',
  },
  secondaryButton: {
    backgroundColor: '#FF3B30',
  },
  secondaryButtonText: {
    color: 'white',
  },
  communityCard: {
  width: '100%',
  backgroundColor: '#f5f5f5',
  padding: 15,
  marginBottom: 10,
  borderRadius: 8,
},
communityName: {
  fontSize: 18,
  fontWeight: 'bold',
  marginBottom: 5,
},
memberCount: {
  fontSize: 14,
  color: '#666',
},
inviteCode: {
  fontSize: 14,
  color: '#007AFF',
  fontWeight: '600',
},
tertiaryButton: {
  backgroundColor: '#34C759',
},
opponentCard: {
  width: '100%',
  backgroundColor: '#007AFF',
  padding: 15,
  marginBottom: 10,
  borderRadius: 8,
},
opponentName: {
  fontSize: 16,
  fontWeight: 'bold',
  color: 'white',
  textAlign: 'center',
},
backButton: {
  width: '100%',
  backgroundColor: '#666',
  height: 50,
  borderRadius: 8,
  alignItems: 'center',
  justifyContent: 'center',
},
smallButton: {
  backgroundColor: '#34C759',
  padding: 8,
  borderRadius: 5,
  marginTop: 8,
},
smallButtonText: {
  color: 'white',
  fontSize: 12,
  fontWeight: '600',
},
});