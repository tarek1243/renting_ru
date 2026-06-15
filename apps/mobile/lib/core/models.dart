class ApiError implements Exception {
  final String code;
  final String message;
  const ApiError({required this.code, required this.message});
  factory ApiError.fromJson(Map<String, dynamic> j) =>
      ApiError(code: j['code'] as String, message: j['message'] as String);
  @override
  String toString() => message;
}

class Pagination {
  final int page, perPage, total, totalPages;
  const Pagination({required this.page, required this.perPage, required this.total, required this.totalPages});
  factory Pagination.fromJson(Map<String, dynamic> j) => Pagination(
        page: j['page'] as int,
        perPage: j['perPage'] as int,
        total: j['total'] as int,
        totalPages: j['totalPages'] as int,
      );
  bool get hasMore => page < totalPages;
}

class User {
  final String id, name, email;
  final String? phone, licenseStatus;
  final List<String> roles;
  const User({required this.id, required this.name, required this.email, this.phone, this.licenseStatus, required this.roles});
  factory User.fromJson(Map<String, dynamic> j) => User(
        id: j['id'] as String,
        name: j['name'] as String,
        email: j['email'] as String,
        phone: j['phone'] as String?,
        licenseStatus: j['licenseStatus'] as String?,
        roles: List<String>.from(j['roles'] as List),
      );
}

class Category {
  final String id, slug;
  final Map<String, String> name;
  final String? icon;
  final bool isEnabled;
  final List<CategoryAttribute> attributes;
  final List<PricingUnit> pricingUnits;
  const Category({required this.id, required this.slug, required this.name, this.icon, required this.isEnabled, required this.attributes, required this.pricingUnits});
  factory Category.fromJson(Map<String, dynamic> j) => Category(
        id: j['id'] as String,
        slug: j['slug'] as String,
        name: Map<String, String>.from(j['name'] as Map),
        icon: j['icon'] as String?,
        isEnabled: j['isEnabled'] as bool,
        attributes: (j['attributes'] as List? ?? []).map((a) => CategoryAttribute.fromJson(a as Map<String, dynamic>)).toList(),
        pricingUnits: (j['pricingUnits'] as List? ?? []).map((p) => PricingUnit.fromJson(p as Map<String, dynamic>)).toList(),
      );
  String localName(String locale) => name[locale] ?? name['en'] ?? slug;
  PricingUnit? get defaultUnit => pricingUnits.where((u) => u.isDefault).firstOrNull ?? pricingUnits.firstOrNull;
}

class CategoryAttribute {
  final String key, dataType, filterWidget;
  final Map<String, String> label;
  final List<String>? options;
  final bool isRequired;
  const CategoryAttribute({required this.key, required this.dataType, required this.filterWidget, required this.label, this.options, required this.isRequired});
  factory CategoryAttribute.fromJson(Map<String, dynamic> j) => CategoryAttribute(
        key: j['key'] as String,
        dataType: j['dataType'] as String,
        filterWidget: j['filterWidget'] as String,
        label: Map<String, String>.from(j['label'] as Map),
        options: j['options'] != null ? List<String>.from(j['options'] as List) : null,
        isRequired: j['isRequired'] as bool? ?? false,
      );
  String localLabel(String locale) => label[locale] ?? label['en'] ?? key;
}

class PricingUnit {
  final String unit;
  final bool isDefault;
  const PricingUnit({required this.unit, required this.isDefault});
  factory PricingUnit.fromJson(Map<String, dynamic> j) => PricingUnit(unit: j['unit'] as String, isDefault: j['isDefault'] as bool);
}

class Listing {
  final String id, slug;
  final Map<String, String> title;
  final Map<String, String>? description;
  final Map<String, dynamic> attributes;
  final List<ListingPrice> prices;
  final List<ListingMedia> media;
  final List<ListingExtra> extras;
  final double? averageRating;
  final int reviewCount;
  final bool withDriverAllowed, requiresLicense;
  final ListingLocation? location;

  const Listing({required this.id, required this.slug, required this.title, this.description, required this.attributes, required this.prices, required this.media, required this.extras, this.averageRating, required this.reviewCount, required this.withDriverAllowed, required this.requiresLicense, this.location});

  factory Listing.fromJson(Map<String, dynamic> j) => Listing(
        id: j['id'] as String,
        slug: j['slug'] as String,
        title: Map<String, String>.from(j['title'] as Map),
        description: j['description'] != null ? Map<String, String>.from(j['description'] as Map) : null,
        attributes: j['attributes'] as Map<String, dynamic>? ?? {},
        prices: (j['prices'] as List? ?? []).map((p) => ListingPrice.fromJson(p as Map<String, dynamic>)).toList(),
        media: (j['media'] as List? ?? []).map((m) => ListingMedia.fromJson(m as Map<String, dynamic>)).toList(),
        extras: (j['extras'] as List? ?? []).map((e) => ListingExtra.fromJson(e as Map<String, dynamic>)).toList(),
        averageRating: (j['averageRating'] as num?)?.toDouble(),
        reviewCount: j['reviewCount'] as int? ?? 0,
        withDriverAllowed: j['withDriverAllowed'] as bool? ?? false,
        requiresLicense: j['requiresLicense'] as bool? ?? false,
        location: j['location'] != null ? ListingLocation.fromJson(j['location'] as Map<String, dynamic>) : null,
      );

  String localTitle(String locale) => title[locale] ?? title['en'] ?? slug;
  String? localDescription(String locale) {
    if (description == null) return null;
    return description![locale] ?? description!['en'];
  }
  String? get primaryImageUrl => media.where((m) => m.isPrimary).firstOrNull?.url ?? media.firstOrNull?.url;
  ListingPrice? get dayPrice => prices.where((p) => p.unit == 'day').firstOrNull ?? prices.firstOrNull;
}

class ListingPrice {
  final String unit, currency;
  final double amount;
  const ListingPrice({required this.unit, required this.currency, required this.amount});
  factory ListingPrice.fromJson(Map<String, dynamic> j) => ListingPrice(unit: j['unit'] as String, currency: j['currency'] as String, amount: (j['amount'] as num).toDouble());
}

class ListingMedia {
  final String url;
  final bool isPrimary;
  const ListingMedia({required this.url, required this.isPrimary});
  factory ListingMedia.fromJson(Map<String, dynamic> j) => ListingMedia(url: j['url'] as String, isPrimary: j['isPrimary'] as bool? ?? false);
}

class ListingExtra {
  final String id, pricingUnit;
  final Map<String, String> name;
  final double price;
  const ListingExtra({required this.id, required this.name, required this.price, required this.pricingUnit});
  factory ListingExtra.fromJson(Map<String, dynamic> j) => ListingExtra(id: j['id'] as String, name: Map<String, String>.from(j['name'] as Map), price: (j['price'] as num).toDouble(), pricingUnit: j['pricingUnit'] as String);
  String localName(String locale) => name[locale] ?? name['en'] ?? id;
}

class ListingLocation {
  final String id, name;
  final double? lat, lng;
  const ListingLocation({required this.id, required this.name, this.lat, this.lng});
  factory ListingLocation.fromJson(Map<String, dynamic> j) => ListingLocation(id: j['id'] as String, name: j['name'] as String, lat: (j['lat'] as num?)?.toDouble(), lng: (j['lng'] as num?)?.toDouble());
}

class Quote {
  final String currency;
  final List<QuoteLine> breakdown;
  final double subtotal, driverFee, extrasTotal, discountAmount, taxAmount, depositAmount, totalAmount;
  const Quote({required this.currency, required this.breakdown, required this.subtotal, required this.driverFee, required this.extrasTotal, required this.discountAmount, required this.taxAmount, required this.depositAmount, required this.totalAmount});
  factory Quote.fromJson(Map<String, dynamic> j) => Quote(
        currency: j['currency'] as String,
        breakdown: (j['breakdown'] as List).map((b) => QuoteLine.fromJson(b as Map<String, dynamic>)).toList(),
        subtotal: (j['subtotal'] as num).toDouble(),
        driverFee: (j['driverFee'] as num).toDouble(),
        extrasTotal: (j['extrasTotal'] as num).toDouble(),
        discountAmount: (j['discountAmount'] as num).toDouble(),
        taxAmount: (j['taxAmount'] as num).toDouble(),
        depositAmount: (j['depositAmount'] as num).toDouble(),
        totalAmount: (j['totalAmount'] as num).toDouble(),
      );
}

class QuoteLine {
  final String label;
  final double amount;
  const QuoteLine({required this.label, required this.amount});
  factory QuoteLine.fromJson(Map<String, dynamic> j) => QuoteLine(label: j['label'] as String, amount: (j['amount'] as num).toDouble());
}

class Booking {
  final String id, code, status, currency;
  final double totalAmount;
  final DateTime startAt, endAt, createdAt;
  final Map<String, dynamic>? listing;
  final BookingPayment? payment;
  final String? notes;

  const Booking({required this.id, required this.code, required this.status, required this.currency, required this.totalAmount, required this.startAt, required this.endAt, required this.createdAt, this.listing, this.payment, this.notes});

  factory Booking.fromJson(Map<String, dynamic> j) => Booking(
        id: j['id'] as String,
        code: j['code'] as String,
        status: j['status'] as String,
        currency: j['currency'] as String,
        totalAmount: (j['totalAmount'] as num).toDouble(),
        startAt: DateTime.parse(j['startAt'] as String),
        endAt: DateTime.parse(j['endAt'] as String),
        createdAt: DateTime.parse(j['createdAt'] as String),
        listing: j['listing'] as Map<String, dynamic>?,
        payment: j['payment'] != null ? BookingPayment.fromJson(j['payment'] as Map<String, dynamic>) : null,
        notes: j['notes'] as String?,
      );

  String get statusLabel {
    const labels = {
      'pending': 'Awaiting confirmation',
      'confirmed': 'Confirmed',
      'in_progress': 'In progress',
      'completed': 'Completed',
      'cancelled': 'Cancelled',
      'disputed': 'Under dispute',
      'refunded': 'Refunded',
      'no_show': 'No-show',
    };
    return labels[status] ?? status;
  }

  bool get canCancel => status == 'pending' || status == 'confirmed';
  bool get canReview => status == 'completed';
}

class BookingPayment {
  final String status, method;
  final String? clientSecret;
  const BookingPayment({required this.status, required this.method, this.clientSecret});
  factory BookingPayment.fromJson(Map<String, dynamic> j) => BookingPayment(status: j['status'] as String, method: j['method'] as String? ?? 'unknown', clientSecret: j['clientSecret'] as String?);
}

class AppNotification {
  final String id, title, body, type;
  final bool isRead;
  final DateTime createdAt;
  const AppNotification({required this.id, required this.title, required this.body, required this.type, required this.isRead, required this.createdAt});
  factory AppNotification.fromJson(Map<String, dynamic> j) => AppNotification(id: j['id'] as String, title: j['title'] as String, body: j['body'] as String, type: j['type'] as String, isRead: j['isRead'] as bool, createdAt: DateTime.parse(j['createdAt'] as String));
}
