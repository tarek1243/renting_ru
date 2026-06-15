import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

final tokenStorageProvider = Provider<TokenStorage>((_) => TokenStorage());

class TokenStorage {
  final _storage = const FlutterSecureStorage();
  static const _access = 'access_token';
  static const _refresh = 'refresh_token';

  Future<String?> getAccessToken() => _storage.read(key: _access);
  Future<String?> getRefreshToken() => _storage.read(key: _refresh);

  Future<void> setTokens(String access, String refresh) async {
    await _storage.write(key: _access, value: access);
    await _storage.write(key: _refresh, value: refresh);
  }

  Future<void> clear() async {
    await _storage.delete(key: _access);
    await _storage.delete(key: _refresh);
  }
}
