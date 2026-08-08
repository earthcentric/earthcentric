const fs = require('fs');

function fixProducts() {
  let content = fs.readFileSync('src/actions/products.ts', 'utf8');

  // Revert the interface types
  content = content.replace(/badgeType\?: "verified" \| "bestseller" \| "eco" \| null;/g, 'badgeType?: "verified" | "bestseller" | "eco";');
  content = content.replace(/moq\?: number \| null;/g, 'moq?: number;');
  content = content.replace(/wholesalePrice\?: number \| null;/g, 'wholesalePrice?: number;');
  content = content.replace(/originalPrice\?: number \| null;/g, 'originalPrice?: number;');
  
  // Revert back all '|| null' and '? null :' to explicit undefined
  content = content.replace(/\|\| null/g, '|| undefined');
  content = content.replace(/\? null :/g, '? undefined :');
  content = content.replace(/: null/g, ': undefined');

  // Now, inject cleanUndefined at the top
  if (!content.includes('function cleanUndefined')) {
    const helper = `
function cleanUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Date) return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => cleanUndefined(item)) as any;
  }
  if (typeof obj === 'object') {
    const res: any = {};
    for (const key in obj) {
      if (obj[key] !== undefined) {
        res[key] = cleanUndefined(obj[key]);
      }
    }
    return res;
  }
  return obj;
}
`;
    content = content.replace(/export interface/, helper + '\nexport interface');
  }

  // Find exported functions that return arrays or objects, and wrap their return statements.
  content = content.replace(/return list\.map\(/g, 'return cleanUndefined(list.map(');
  content = content.replace(/return dbProducts\.map\(/g, 'return cleanUndefined(dbProducts.map(');
  content = content.replace(/return \{(?:\s|\n)+id: p\.id,(?:\s|\n)+name: p\.name/g, 'return cleanUndefined({\n      id: p.id,\n      name: p.name');
  content = content.replace(/productDate: p\.createdAt\.toISOString\(\)\.split\("T"\)\[0\],\n\s+\};\n  \} catch/g, 'productDate: p.createdAt.toISOString().split("T")[0],\n    });\n  } catch');

  content = content.replace(/return \{(?:\s|\n)+id: dbProd\.id/g, 'return cleanUndefined({\n      id: dbProd.id');
  content = content.replace(/reviewsCount: 0,\n\s+\};/g, 'reviewsCount: 0,\n    });');

  content = content.replace(/return dyn;/g, 'return cleanUndefined(dyn);');
  content = content.replace(/return mock;/g, 'return cleanUndefined(mock);');
  content = content.replace(/return p \|\| null;/g, 'return cleanUndefined(p || null);');
  content = content.replace(/return getMockProductsFiltered/g, 'return cleanUndefined(getMockProductsFiltered');
  
  fs.writeFileSync('src/actions/products.ts', content);
}

function fixSellers() {
  let content = fs.readFileSync('src/actions/sellers.ts', 'utf8');

  // Revert the SellerProfile interface | null
  const fields = [
    'userName', 'description', 'logoUrl', 'companyLogo', 'website', 'gstNumber', 'panNumber',
    'declaredRevenue', 'rejectionReason', 'phone', 'ownerName', 'founderName', 'aadharNumber',
    'factoryAddress', 'pickupAddress', 'companyAddress', 'bankAccountNo', 'bankName', 'bankIfsc', 'bankProofUrl'
  ];
  for (const f of fields) {
    content = content.replace(new RegExp(f + '\\?: string \\| null;', 'g'), f + '?: string;');
  }
  content = content.replace(/user\?: \{ name: string \| null; email: string \} \| null;/g, 'user?: { name: string | null; email: string };');
  content = content.replace(/trustScore\?: number \| null;/g, 'trustScore?: number;');
  content = content.replace(/badges\?: string\[\] \| null;/g, 'badges?: string[];');
  
  // Revert back all '|| null' and '? null :' to explicit undefined
  content = content.replace(/\|\| null/g, '|| undefined');
  content = content.replace(/\? null :/g, '? undefined :');
  content = content.replace(/: null/g, ': undefined');

  if (!content.includes('function cleanUndefined')) {
    const helper = `
function cleanUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Date) return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => cleanUndefined(item)) as any;
  }
  if (typeof obj === 'object') {
    const res: any = {};
    for (const key in obj) {
      if (obj[key] !== undefined) {
        res[key] = cleanUndefined(obj[key]);
      }
    }
    return res;
  }
  return obj;
}
`;
    content = content.replace(/export interface/, helper + '\nexport interface');
  }

  content = content.replace(/return sellers\.map\(seller => \(\{/g, 'return cleanUndefined(sellers.map(seller => ({');
  content = content.replace(/badges: seller\.badges,\n\s+\}\)\);/g, 'badges: seller.badges,\n    })));');

  content = content.replace(/return mockSellers\.filter/g, 'return cleanUndefined(mockSellers.filter');
  content = content.replace(/== "APPROVED"\);/g, '== "APPROVED"));');

  content = content.replace(/return \{(?:\s|\n)+id: seller\.id,(?:\s|\n)+userId: seller\.userId,/g, 'return cleanUndefined({\n      id: seller.id,\n      userId: seller.userId,');
  content = content.replace(/fileUrl: getUrlFromDb\(doc\.fileUrl\),\n\s+\}\)\),\n\s+\};/g, 'fileUrl: getUrlFromDb(doc.fileUrl),\n      })),\n    });');

  content = content.replace(/return \{(?:\s|\n)+id: updatedSeller\.id,(?:\s|\n)+userId: updatedSeller\.userId,/g, 'return cleanUndefined({\n      id: updatedSeller.id,\n      userId: updatedSeller.userId,');
  content = content.replace(/fileUrl: getUrlFromDb\(d\.fileUrl\),\n\s+\}\)\),\n\s+\};/g, 'fileUrl: getUrlFromDb(d.fileUrl),\n      })),\n    });');

  content = content.replace(/return mappedProfile;/g, 'return cleanUndefined(mappedProfile);');

  content = content.replace(/return \{(?:\s|\n)+\.\.\.newSeller,(?:\s|\n)+documents: newSeller\.documents\.map\(doc => \(\{ \.\.\.doc, fileUrl: getUrlFromDb\(doc\.fileUrl\) \}\)\)(?:\s|\n)+\};/g, 'return cleanUndefined({\n          ...newSeller,\n          documents: newSeller.documents.map(doc => ({ ...doc, fileUrl: getUrlFromDb(doc.fileUrl) }))\n        });');
  content = content.replace(/return \{(?:\s|\n)+\.\.\.existing,(?:\s|\n)+documents: existing\.documents\.map/g, 'return cleanUndefined({\n          ...existing,\n          documents: existing.documents.map');

  fs.writeFileSync('src/actions/sellers.ts', content);
}

fixProducts();
fixSellers();
