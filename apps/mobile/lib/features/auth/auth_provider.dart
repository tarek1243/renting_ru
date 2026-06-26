import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api_client.dart';
import '../../core/models.dart';
import '../../core/token_storage.dart';

class AuthNotifier extends AsyncNotifier<User?> {
  @override
  Future<User?> build() async {
    final storage = ref.read(tokenStorageProvider);
    final token = await storage.getAccessToken();
    if (token == null) return null;
    try {
      return await ref
          .read(apiClientProvider)
          .get('/auth/me', (d) => User.fromJson(d as Map<String, dynamic>));
    } catch (_) {
      await storage.clear();
      return null;
    }
  }

  Future<void> login(String email, String password) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final api = ref.read(apiClientProvider);
      final data = await api.post<Map<String, dynamic>>(
        '/auth/login',
        (d) => d as Map<String, dynamic>,
        body: {'email': email, 'password': password},
      );
      await ref
          .read(tokenStorageProvider)
          .setTokens(
            data['accessToken'] as String,
            data['refreshToken'] as String,
          );
      return User.fromJson(data['user'] as Map<String, dynamic>);
    });
  }

  Future<void> register(
    String name,
    String email,
    String password,
    String? phone,
    String gender,
  ) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final api = ref.read(apiClientProvider);
      final parts = name.trim().split(RegExp(r'\s+'));
      final body = {
        'firstName': parts.isNotEmpty ? parts.first : name,
        'lastName': parts.length > 1 ? parts.skip(1).join(' ') : '',
        'email': email,
        'password': password,
        'gender': gender,
        if (phone != null && phone.isNotEmpty) 'phone': phone,
      };
      final data = await api.post<Map<String, dynamic>>(
        '/auth/register',
        (d) => d as Map<String, dynamic>,
        body: body,
      );
      await ref
          .read(tokenStorageProvider)
          .setTokens(
            data['accessToken'] as String,
            data['refreshToken'] as String,
          );
      return User.fromJson(data['user'] as Map<String, dynamic>);
    });
  }

  Future<void> logout() async {
    try {
      final storage = ref.read(tokenStorageProvider);
      final refresh = await storage.getRefreshToken();
      if (refresh != null) {
        await ref
            .read(apiClientProvider)
            .post('/auth/logout', (_) => null, body: {'refreshToken': refresh});
      }
    } finally {
      await ref.read(tokenStorageProvider).clear();
      state = const AsyncData(null);
    }
  }
}

final authProvider = AsyncNotifierProvider<AuthNotifier, User?>(
  () => AuthNotifier(),
);
