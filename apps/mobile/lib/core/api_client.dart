import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'models.dart';
import 'token_storage.dart';

// Set your Railway API URL here (no trailing slash, include /api/v1)
const _baseUrl = String.fromEnvironment(
  'API_URL',
  defaultValue: 'https://YOUR_API_SERVICE.up.railway.app/api/v1',
);

final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient(ref.read(tokenStorageProvider));
});

class ApiClient {
  late final Dio _dio;
  final TokenStorage _storage;

  ApiClient(this._storage) {
    _dio = Dio(BaseOptions(
      baseUrl: _baseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 30),
      headers: {'Content-Type': 'application/json'},
    ));

    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (opts, handler) async {
        final token = await _storage.getAccessToken();
        if (token != null) opts.headers['Authorization'] = 'Bearer $token';
        handler.next(opts);
      },
      onError: (err, handler) async {
        if (err.response?.statusCode == 401) {
          try {
            final refresh = await _storage.getRefreshToken();
            if (refresh == null) {
              await _storage.clear();
              handler.next(err);
              return;
            }
            final res = await Dio().post('$_baseUrl/auth/refresh', data: {'refreshToken': refresh});
            final data = res.data['data'] as Map<String, dynamic>;
            await _storage.setTokens(data['accessToken'] as String, data['refreshToken'] as String);
            final opts = err.requestOptions;
            opts.headers['Authorization'] = 'Bearer ${data['accessToken']}';
            final retried = await _dio.fetch(opts);
            handler.resolve(retried);
          } catch (_) {
            await _storage.clear();
            handler.next(err);
          }
        } else {
          handler.next(err);
        }
      },
    ));
  }

  // Parses envelope and throws ApiError on failure
  Future<T> _call<T>(Future<Response> request, T Function(dynamic) parse) async {
    try {
      final res = await request;
      final body = res.data as Map<String, dynamic>;
      if (body['success'] == true) {
        return parse(body['data']);
      }
      final err = body['error'] as Map<String, dynamic>?;
      throw ApiError(code: err?['code'] as String? ?? 'UNKNOWN', message: err?['message'] as String? ?? 'Unknown error');
    } on DioException catch (e) {
      final body = e.response?.data as Map<String, dynamic>?;
      final err = body?['error'] as Map<String, dynamic>?;
      throw ApiError(code: err?['code'] as String? ?? 'NETWORK_ERROR', message: err?['message'] as String? ?? e.message ?? 'Network error');
    }
  }

  Future<T> get<T>(String path, T Function(dynamic) parse, {Map<String, dynamic>? params}) =>
      _call(_dio.get(path, queryParameters: params), parse);

  Future<T> post<T>(String path, T Function(dynamic) parse, {Object? body}) =>
      _call(_dio.post(path, data: body), parse);

  Future<T> patch<T>(String path, T Function(dynamic) parse, {Object? body}) =>
      _call(_dio.patch(path, data: body), parse);

  Future<T> delete<T>(String path, T Function(dynamic) parse) =>
      _call(_dio.delete(path), parse);

  Future<void> put(String path, {Object? body}) =>
      _call(_dio.put(path, data: body), (_) => null);
}
