import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api_client.dart';
import '../../core/models.dart';

class ListingFilter {
  final String? startAt, endAt;
  final String? sortBy, sortDir;
  final Map<String, dynamic> attrs;
  final int page;

  const ListingFilter({this.startAt, this.endAt, this.sortBy = 'createdAt', this.sortDir = 'desc', this.attrs = const {}, this.page = 1});

  ListingFilter copyWith({String? startAt, String? endAt, String? sortBy, String? sortDir, Map<String, dynamic>? attrs, int? page}) => ListingFilter(
        startAt: startAt ?? this.startAt,
        endAt: endAt ?? this.endAt,
        sortBy: sortBy ?? this.sortBy,
        sortDir: sortDir ?? this.sortDir,
        attrs: attrs ?? this.attrs,
        page: page ?? this.page,
      );

  Map<String, dynamic> toQueryParams() => {
        if (startAt != null) 'startAt': startAt,
        if (endAt != null) 'endAt': endAt,
        if (sortBy != null) 'sortBy': sortBy,
        if (sortDir != null) 'sortDir': sortDir,
        if (attrs.isNotEmpty) 'attrs': jsonEncode(attrs),
        'page': page.toString(),
        'perPage': '12',
      };
}

class ListingsResult {
  final List<Listing> items;
  final int total;
  final Pagination? pagination;
  const ListingsResult({required this.items, required this.total, this.pagination});
}

final listingFilterProvider = StateProvider.family<ListingFilter, String>((_, __) => const ListingFilter());

final listingsProvider = FutureProvider.family<ListingsResult, (String slug, ListingFilter filter)>((ref, args) async {
  final (slug, filter) = args;
  return ref.read(apiClientProvider).get(
        '/categories/$slug/listings',
        (d) {
          final map = d as Map<String, dynamic>;
          return ListingsResult(
            items: (map['items'] as List).map((i) => Listing.fromJson(i as Map<String, dynamic>)).toList(),
            total: map['total'] as int? ?? 0,
          );
        },
        params: filter.toQueryParams(),
      );
});

final listingDetailProvider = FutureProvider.family<Listing, (String categorySlug, String listingSlug)>((ref, args) async {
  final (categorySlug, listingSlug) = args;
  return ref.read(apiClientProvider).get('/categories/$categorySlug/listings/$listingSlug', (d) => Listing.fromJson(d as Map<String, dynamic>));
});
