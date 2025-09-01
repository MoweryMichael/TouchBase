// This is my app.js file which holds basically the whole TouchBase app: game screens and other components and logic

import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { 
 View, 
 Text, 
 TextInput, 
 TouchableOpacity, 
 StyleSheet, 
 Alert,
 ActivityIndicator
} from 'react-native';
import { 
 createUserWithEmailAndPassword, 
 signInWithEmailAndPassword,
 signOut,
 updateProfile,
 onAuthStateChanged
} from 'firebase/auth';
import { 
  createCommunity,
  generateInviteCode,
  joinCommunity,
  getUserCommunities,
  addMockMembers,
  getCommunityMembers,
  getMockMemberName,
  createGame,
  getMyGames,
  submitMyGuess,
  submitMyActualContact,
  autoFillMockPlayer,
  isGameBot,
 } from './communityService';
import { 
  collection,
  query, 
  where, 
  onSnapshot,
  doc,
  getDocs, 
 } from 'firebase/firestore';
import { auth, db } from './firebase';

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
    Alert.alert('Success', 'Account created! Welcome to TouchBase!');
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

// My Games Screen - shows user's games
function MyGamesScreen({ navigation }) {
  const [games, setGames] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  // Set up listeners exactly once for the current user
  React.useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const col = collection(db, 'games');
    const q1 = query(col, where('player1Id', '==', uid));
    const q2 = query(col, where('player2Id', '==', uid));

    const unsub1 = onSnapshot(q1, (snap) => {
      setGames((prev) => {
        const rest = prev.filter(g => g._side !== 'p1');
        const fresh = snap.docs.map(d => ({ id: d.id, ...d.data(), _side: 'p1' }));
        return [...rest, ...fresh];
      });
      setLoading(false);
    });

    const unsub2 = onSnapshot(q2, (snap) => {
      setGames((prev) => {
        const rest = prev.filter(g => g._side !== 'p2');
        const fresh = snap.docs.map(d => ({ id: d.id, ...d.data(), _side: 'p2' }));
        return [...rest, ...fresh];
      });
      setLoading(false);
    });

    return () => { unsub1(); unsub2(); };
  }, []);

  // ❗ Hooks must be called unconditionally (before any early returns)
  const deduped = React.useMemo(() => {
    const map = new Map();
    for (const g of games) map.set(g.id, g);
    return Array.from(map.values());
  }, [games]);

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Loading games…</Text>
      </View>
    );
  }

  if (deduped.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={{ color: '#666', marginBottom: 20 }}>No games yet.</Text>
        <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('GameList')}>
          <Text style={styles.buttonText}>Start New Game</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Games</Text>
      {deduped.map(g => (
        <TouchableOpacity
          key={g.id}
          style={styles.communityCard}
          onPress={() => navigation.navigate('Game', { gameId: g.id })}
        >
          <Text style={styles.communityName}>
            Game vs. {g.player1Id === auth.currentUser.uid
              ? getMockMemberName(g.player2Id)
              : getMockMemberName(g.player1Id)}
          </Text>
          <Text style={styles.memberCount}>Status: {g.status || 'active'}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// The actual GameScreen to play with other people
function GameScreen({ route, navigation }) {
  const { gameId } = route.params;
  const [game, setGame] = React.useState(null);
  const [members, setMembers] = React.useState([]);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    const unsub = onSnapshot(doc(db, 'games', gameId), (snap) => {
      if (snap.exists()) setGame({ id: snap.id, ...snap.data() });
    });
    return () => unsub();
  }, [gameId]);

  // Load members and auto-fill for mock players
  React.useEffect(() => {
    (async () => {
      try {
        if (game?.communityId) {
          const { community } = await getCommunityMembers(game.communityId);
          const allMembers = Array.isArray(community?.members) ? [...community.members] : [];
          setMembers(allMembers);

          // Auto-fill mock player moves for testing
          if ((game?.player2Id?.startsWith?.('mock_user_')) || (game?.player1Id?.startsWith?.('mock_user_'))) {
            await autoFillMockPlayer(gameId);
          }
        }
      } catch (e) {
        console.log('load members error', e);
      }
    })();
  }, [game?.communityId, gameId]);

  if (!game) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={{ marginTop: 10 }}>Loading game…</Text>
      </View>
    );
  }

  const me = game.player1Id === auth.currentUser.uid ? 'player1' : 'player2';
  const opponent = me === 'player1' ? 'player2' : 'player1';
  const myGuess = me === 'player1' ? game.player1Guess : game.player2Guess;
  const myActual = me === 'player1' ? game.player1ActualContact : game.player2ActualContact;
  const opponentGuess = opponent === 'player1' ? game.player1Guess : game.player2Guess;
  const opponentActual = opponent === 'player1' ? game.player1ActualContact : game.player2ActualContact;

  const handleGuess = async (memberId) => {
    try {
      setBusy(true);
      await submitMyGuess(gameId, memberId);
      Alert.alert('Guess Submitted!', 'Now reveal who actually contacted you.');
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleReveal = async (memberId) => {
    try {
      setBusy(true);
      await submitMyActualContact(gameId, memberId);
      Alert.alert('Contact Revealed!', 'Waiting for game to complete...');
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setBusy(false);
    }
  };

  // Completed game results
  if (game.status === 'completed') {
    const didIWin = game.winner === me || game.winner === 'tie';
    const bothWrong = game.outcome === 'both_wrong' || game.winner === 'none';

    return (
      <View style={styles.container}>
        <Text style={styles.title}>Game Complete!</Text>

        <View style={styles.communityCard}>
          <Text style={styles.communityName}>
            {didIWin ? '🎉 ' : ''}
            {game.winner === 'tie'
              ? 'Both Correct!'
              : bothWrong
                ? 'Both Wrong!'
                : didIWin
                  ? 'You Won!'
                  : 'You Lost'}
          </Text>

          <Text style={styles.memberCount}>Your guess: {myGuess ? getMockMemberName(myGuess) : '—'}</Text>
          <Text style={styles.memberCount}>They actually contacted: {opponentActual ? getMockMemberName(opponentActual) : '—'}</Text>

          <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#ddd' }}>
            <Text style={styles.memberCount}>Their guess: {opponentGuess ? getMockMemberName(opponentGuess) : '—'}</Text>
            <Text style={styles.memberCount}>You actually contacted: {myActual ? getMockMemberName(myActual) : '—'}</Text>
          </View>
        </View>

        {Array.isArray(game.consequences) && game.consequences.length > 0 && (
          <View style={styles.communityCard}>
            <Text style={styles.communityName}>Consequences:</Text>
            {game.consequences.map((c, i) => (
              <Text key={i} style={styles.memberCount}>• {c?.description || '—'}</Text>
            ))}
          </View>
        )}

        <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('MyGames')}>
          <Text style={styles.buttonText}>Back to Games</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Mid-game flags
  const bothGuessed = Boolean(game.player1Guess && game.player2Guess);
  const bothRevealed = Boolean(game.player1ActualContact && game.player2ActualContact);

  const showGuessPhase = !myGuess;
  const showRevealPhase = myGuess && !myActual;
  const waitingForOpponent = myGuess && myActual && !game.outcome;

  const statusBanner = (game.status === 'guessing_complete' && !bothRevealed) ? (
    <View style={[styles.communityCard, { borderLeftWidth: 4, borderLeftColor: '#007AFF' }]}>
      <Text style={styles.memberCount}>Both guesses are in — time to reveal your actual contact.</Text>
    </View>
  ) : null;

  // Waiting screen
  if (waitingForOpponent) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Waiting for Opponent</Text>
        <ActivityIndicator size="large" color="#007AFF" style={{ marginVertical: 20 }} />
        <Text style={styles.subtitle}>Your moves are submitted. Waiting for opponent...</Text>

        <View style={styles.communityCard}>
          <Text style={styles.communityName}>Your guess: {getMockMemberName(myGuess)}</Text>
          <Text style={styles.memberCount}>Your actual contact: {getMockMemberName(myActual)}</Text>
        </View>
      </View>
    );
  }

  // Active game
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{showGuessPhase ? 'Make Your Guess' : 'Reveal Your Contact'}</Text>

      {statusBanner}

      <Text style={styles.subtitle}>
        {showGuessPhase
          ? 'Who do you think contacted your opponent most recently?'
          : 'Who from this community contacted YOU most recently?'}
      </Text>

      {showGuessPhase ? (
        members
          .filter(m => m !== auth.currentUser.uid && m !== game.player2Id && m !== game.player1Id)
          .map(m => (
            <TouchableOpacity
              key={m}
              style={styles.opponentCard}
              onPress={() => handleGuess(m)}
              disabled={busy}
            >
              <Text style={styles.opponentName}>{getMockMemberName(m)}</Text>
            </TouchableOpacity>
          ))
      ) : (
        <>
          <View style={styles.communityCard}>
            <Text style={styles.memberCount}>Your guess was: {getMockMemberName(myGuess)}</Text>
          </View>

          {members
            .filter(m => m !== auth.currentUser.uid)
            .map(m => (
              <TouchableOpacity
                key={m}
                style={[styles.opponentCard, { backgroundColor: '#34C759' }]}
                onPress={() => handleReveal(m)}
                disabled={busy}
              >
                <Text style={styles.opponentName}>{getMockMemberName(m)}</Text>
              </TouchableOpacity>
            ))}
        </>
      )}
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
      Alert.alert('Error', error.message || 'Failed to load communities');
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

      <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('MyGames')}>
        <Text style={styles.buttonText}>My Games</Text>
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

      <TouchableOpacity
        style={[styles.button, { backgroundColor: '#8E8E93' }]}
        onPress={async () => {
          try {
            const snap = await getDocs(collection(db, 'games'));
            Alert.alert('Games debug', `Total games in DB: ${snap.size}`);
          } catch (e) {
            Alert.alert('Games debug error', e.message);
          }
        }}
      >
        <Text style={styles.buttonText}>Debug: Count Games</Text>
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
        { text: 'OK', onPress: () => navigation.navigate('Game', { gameId: game.id }) }
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
function AuthGate({ children, onAuthed, onAnon }) {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u || null);
      setInitializing(false);
    });
    return unsub;
  }, []);

  if (initializing) {
    return (
      <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8 }}>Loading…</Text>
      </View>
    );
  }

  return user ? onAuthed : onAnon;
}

export default function App() {
  // Logged-out stack (Login + Signup)
  const AuthStack = (
    <Stack.Navigator 
      initialRouteName="Login"
      screenOptions={{
        headerStyle: { backgroundColor: '#007AFF' },
        headerTintColor: 'white',
        headerTitleStyle: { fontWeight: 'bold' }
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Signup" component={SignupScreen} options={{ title: 'Create Account' }} />
    </Stack.Navigator>
  );

  // Logged-in stack (your app)
  const AppStack = (
    <Stack.Navigator 
      initialRouteName="Home"
      screenOptions={{
        headerStyle: { backgroundColor: '#007AFF' },
        headerTintColor: 'white',
        headerTitleStyle: { fontWeight: 'bold' }
      }}
    >
    <Stack.Screen
      name="Home"
      component={CommunityListScreen}
      options={{ title: 'TouchBase Communities', headerBackVisible: false }}
    />
      <Stack.Screen name="CreateCommunity" component={CreateCommunityScreen} options={{ title: 'Create Community' }} />
      <Stack.Screen name="JoinCommunity" component={JoinCommunityScreen} options={{ title: 'Join Community' }} />
      <Stack.Screen name="GameList" component={GameListScreen} options={{ title: 'Start New Game' }} />
      <Stack.Screen name="MyGames" component={MyGamesScreen} options={{ title: 'My Games' }} />
      <Stack.Screen name="Game" component={GameScreen} options={{ title: 'Game' }} />
    </Stack.Navigator>
  );

  return (
    <NavigationContainer>
      <AuthGate onAuthed={AppStack} onAnon={AuthStack} />
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