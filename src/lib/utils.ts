import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(amount);
}

/**
 * Cleans a raw bank transaction description to make it more readable by extracting the merchant.
 * @param description The raw description string.
 * @returns A cleaned-up, more user-friendly description.
 */
export function cleanDescription(description: string): string {
    if (!description) return "Sin descripción";

    let cleanDesc = description.toUpperCase();

    // List of common merchants to identify
    const merchants = [
        "WAL-MART", "WALMART", "SEDANOS", "AMAZON", "AMZN", "PUBLIX", "TARGET", "COSTCO", "CVS", "WALGREENS",
        "HOME DEPOT", "UBER", "LYFT", "CHEVRON", "SHELL", "EXXON", "SUNPASS", "GOOGLE", "APPLE", "NETFLIX",
        "SPOTIFY", "ZELLE", "PAYPAL", "STARBUCKS"
    ];

    // Generic patterns to remove
    const patternsToRemove = [
        /PURCHASE AUTHORIZED ON \d{1,2}\/\d{1,2}/,
        /RECURRING PAYMENT AUTHORIZED ON \d{1,2}\/\d{1,2}/,
        /DEBIT CARD PURCHASE/,
        /ONLINE TRANSFER \d+ TO/,
        /ID-\d+/,
        /AUTH\/[A-Z0-9]+/,
        /\b\d{10,}\b/, // Remove long numbers (like transaction IDs)
        /^POS /,
        /CHECKCARD \d+/,
        /PAYMENT FROM .* TO/,
        /PAYMENT RECEIVED/,
        /ONLINE PAYMENT/,
    ];

    patternsToRemove.forEach(pattern => {
        cleanDesc = cleanDesc.replace(pattern, '').trim();
    });

    let extractedMerchant: string | null = null;
    for (const merchant of merchants) {
        const regex = new RegExp(`\\b${merchant}\\b`);
        if (regex.test(cleanDesc)) {
            extractedMerchant = merchant;
            break;
        }
    }
    
    // Fallback if no known merchant is found
    if (!extractedMerchant) {
        // Try to find any capitalized word sequence that is not a state code
        const parts = cleanDesc.split(/\s{2,}| \/ | - /).map(p => p.trim());
        const potentialMerchant = parts.find(p =>
            p.length > 3 &&
            /[A-Z]/.test(p) &&
            !/PURCHASE|PAYMENT|TRANSFER|DEBIT|CREDIT/.test(p) &&
            !/\b(FL|CA|NY|TX|GA)\b/.test(p)
        );
        if (potentialMerchant) {
            extractedMerchant = potentialMerchant.split(' ')[0]; // Take the first word
        }
    }

    const cardRegex = /CARD \d{4}/;
    const cardMatch = description.match(cardRegex);
    let cardInfo = cardMatch ? ` - ${cardMatch[0]}` : '';

    if (extractedMerchant) {
        return `${extractedMerchant.replace("AMZN", "AMAZON")}${cardInfo}`.trim();
    }

    // If still no merchant, return a generic but cleaner description
    return cleanDesc.replace(/\s+/g, ' ').trim() || 'Comercio Desconocido';
}
