import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../app.dart';
import '../../core/models.dart';
import '../../core/api_client.dart';
import 'categories_provider.dart';

// ─── Bottom nav shell ────────────────────────────────────────────────────────

class HomeShell extends StatelessWidget {
  final String location;
  final Widget child;
  const HomeShell({super.key, required this.location, required this.child});

  int _selectedIndex(String loc) {
    if (loc.startsWith('/bookings')) return 2;
    if (loc.startsWith('/profile')) return 3;
    if (loc.startsWith('/category') || loc.startsWith('/home')) return loc.startsWith('/category') ? 1 : 0;
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final idx = _selectedIndex(location);
    return Scaffold(
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: idx,
        onDestinationSelected: (i) {
          switch (i) {
            case 0: context.go('/home');
            case 1: context.go('/category/cars');
            case 2: context.go('/bookings');
            case 3: context.go('/profile');
          }
        },
        destinations: [
          NavigationDestination(icon: const Icon(Icons.explore_outlined), selectedIcon: const Icon(Icons.explore), label: l.home),
          NavigationDestination(icon: const Icon(Icons.search_outlined), selectedIcon: const Icon(Icons.search), label: l.browse),
          NavigationDestination(icon: const Icon(Icons.calendar_month_outlined), selectedIcon: const Icon(Icons.calendar_month), label: l.bookings),
          NavigationDestination(icon: const Icon(Icons.person_outlined), selectedIcon: const Icon(Icons.person), label: l.profile),
        ],
      ),
    );
  }
}

// ─── Home tab ─────────────────────────────────────────────────────────────────

final _featuredProvider = FutureProvider.family<List<Listing>, String>((ref, slug) async {
  return ref.read(apiClientProvider).get(
        '/categories/$slug/listings?featured=true&perPage=6',
        (d) {
          final map = d as Map<String, dynamic>;
          return (map['items'] as List).map((i) => Listing.fromJson(i as Map<String, dynamic>)).toList();
        },
      );
});

class HomeTab extends ConsumerWidget {
  const HomeTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context)!;
    final locale = ref.watch(localeProvider).languageCode;
    final categoriesAsync = ref.watch(categoriesProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(l.appName, style: const TextStyle(color: Color(0xFF2563EB), fontWeight: FontWeight.w800)),
        actions: [
          IconButton(
            icon: const Icon(Icons.language_outlined),
            onPressed: () {
              final current = ref.read(localeProvider);
              ref.read(localeProvider.notifier).state = current.languageCode == 'en' ? const Locale('ar') : const Locale('en');
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(categoriesProvider);
        },
        child: categoriesAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(child: Text(e.toString())),
          data: (categories) {
            final firstSlug = categories.firstOrNull?.slug;
            return CustomScrollView(
              slivers: [
                SliverToBoxAdapter(child: _HeroBanner(categories: categories, locale: locale)),
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 24, 16, 8),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(l.featured, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                        if (firstSlug != null)
                          TextButton(onPressed: () => context.go('/category/$firstSlug'), child: Text('${l.browseAll} →')),
                      ],
                    ),
                  ),
                ),
                if (firstSlug != null)
                  _FeaturedListings(slug: firstSlug, locale: locale),
                const SliverToBoxAdapter(child: SizedBox(height: 24)),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _HeroBanner extends StatelessWidget {
  final List<Category> categories;
  final String locale;
  const _HeroBanner({required this.categories, required this.locale});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(color: const Color(0xFF2563EB), borderRadius: BorderRadius.circular(16)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            locale == 'ar' ? 'استئجار بدون تعقيد' : 'Renting without the friction',
            style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 8),
          Text(
            locale == 'ar' ? 'سيارات مع سائق أو بدونه.' : 'Cars with or without a chauffeur.',
            style: const TextStyle(color: Color(0xFFBFDBFE), fontSize: 14),
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: categories.map((c) => _CategoryChip(category: c, locale: locale)).toList(),
          ),
        ],
      ),
    );
  }
}

class _CategoryChip extends StatelessWidget {
  final Category category;
  final String locale;
  const _CategoryChip({required this.category, required this.locale});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.go('/category/${category.slug}'),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(8)),
        child: Text('${category.icon ?? ''} ${category.localName(locale)}', style: const TextStyle(color: Color(0xFF1D4ED8), fontWeight: FontWeight.w600, fontSize: 13)),
      ),
    );
  }
}

class _FeaturedListings extends ConsumerWidget {
  final String slug;
  final String locale;
  const _FeaturedListings({required this.slug, required this.locale});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ref.watch(_featuredProvider(slug)).when(
          loading: () => const SliverToBoxAdapter(child: Center(child: Padding(padding: EdgeInsets.all(32), child: CircularProgressIndicator()))),
          error: (_, __) => const SliverToBoxAdapter(child: SizedBox()),
          data: (listings) => SliverPadding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            sliver: SliverGrid(
              delegate: SliverChildBuilderDelegate(
                (_, i) => _ListingCard(listing: listings[i], locale: locale, categorySlug: slug),
                childCount: listings.length,
              ),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, mainAxisSpacing: 12, crossAxisSpacing: 12, childAspectRatio: 0.75),
            ),
          ),
        );
  }
}

class _ListingCard extends StatelessWidget {
  final Listing listing;
  final String locale;
  final String categorySlug;
  const _ListingCard({required this.listing, required this.locale, required this.categorySlug});

  @override
  Widget build(BuildContext context) {
    final price = listing.dayPrice;
    return GestureDetector(
      onTap: () => context.push('/category/$categorySlug/listing/${listing.slug}'),
      child: Card(
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: listing.primaryImageUrl != null
                  ? CachedNetworkImage(imageUrl: listing.primaryImageUrl!, fit: BoxFit.cover, width: double.infinity, placeholder: (_, __) => Container(color: const Color(0xFFF3F4F6)))
                  : Container(color: const Color(0xFFF3F4F6), child: const Icon(Icons.directions_car, color: Color(0xFFD1D5DB), size: 48)),
            ),
            Padding(
              padding: const EdgeInsets.all(10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(listing.localTitle(locale), style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13), maxLines: 2, overflow: TextOverflow.ellipsis),
                  const SizedBox(height: 4),
                  if (price != null) Text('${price.currency} ${price.amount.toStringAsFixed(0)} / ${price.unit}', style: const TextStyle(color: Color(0xFF2563EB), fontWeight: FontWeight.w700, fontSize: 12)),
                  if (listing.averageRating != null) ...[
                    const SizedBox(height: 4),
                    Row(children: [const Icon(Icons.star, size: 12, color: Color(0xFFF59E0B)), const SizedBox(width: 2), Text(listing.averageRating!.toStringAsFixed(1), style: const TextStyle(fontSize: 11, color: Color(0xFF6B7280)))]),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
