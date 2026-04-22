

'use client';

import {
  collection,
  query,
  getDocs,
  orderBy,
  where,
  writeBatch,
  doc,
  serverTimestamp,
  setDoc,
  getDoc,
  deleteDoc,
  Timestamp,
  arrayUnion,
  updateDoc,
  arrayRemove,
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import type { Transaction, TransactionFirestore, Budget, Import, ImportFirestore, UserProfile } from '@/lib/types';
import { getAuth } from 'firebase/auth';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { format } from 'date-fns';


const { firestore } = initializeFirebase();
const auth = getAuth();

// Simple hashing function to create a unique ID for a transaction
export async function createTransactionHash(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-1', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

// Hashing function for file content
export async function createFileHash(fileContent: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', fileContent);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}


function fromFirestore(docData: any, id: string): Transaction {
    const data = docData as TransactionFirestore;
    return {
      id,
      userId: data.userId,
      importIds: data.importIds,
      date: (data.date as Timestamp).toDate(),
      period: data.period,
      descriptionRaw: data.descriptionRaw,
      descriptionNormalized: data.descriptionNormalized,
      amount: data.amount,
      direction: data.direction,
      type: data.type,
      isTransfer: data.isTransfer,
      category: data.category,
      merchant: data.merchant,
      source: data.source,
      createdAt: (data.createdAt as Timestamp).toDate(),
      updatedAt: (data.updatedAt as Timestamp).toDate(),
      bankType: data.bankType,
      bankSubtype: data.bankSubtype,
    };
  }

export async function getUserTransactions(userId: string): Promise<Transaction[]> {
  if (!userId) {
    console.error("getUserTransactions called without a userId.");
    return [];
  }
  try {
    const transactionsCollection = collection(firestore, 'users', userId, 'transactions');
    const q = query(transactionsCollection, orderBy('date', 'desc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => fromFirestore(doc.data() as TransactionFirestore, doc.id));
  } catch (error) {
    console.error('Error fetching transactions for user', userId, ':', error);
    return [];
  }
}

export async function saveImportedFile(userId: string, fileInfo: Omit<Import, 'id'|'userId'|'createdAt'|'isActive'>): Promise<string> {
    if (!userId) throw new Error("User not authenticated");

    const importId = crypto.randomUUID();
    const importRef = doc(firestore, 'users', userId, 'imports', importId);

    const dataToSave: Omit<Import, 'id'> = {
        ...fileInfo,
        userId: userId,
        createdAt: new Date(),
        isActive: true,
    };
    
    // Firestore expects Timestamps for date fields
    const firestoreData = {
        ...dataToSave,
        createdAt: serverTimestamp(),
        statementStartDate: dataToSave.statementStartDate ? Timestamp.fromDate(dataToSave.statementStartDate) : undefined,
        statementEndDate: dataToSave.statementEndDate ? Timestamp.fromDate(dataToSave.statementEndDate) : undefined,
    };

    await setDoc(importRef, firestoreData);
    return importId;
}

export async function findImportByHash(userId: string, fileHash: string): Promise<Import | null> {
    if (!userId) return null;
    const importsRef = collection(firestore, 'users', userId, 'imports');
    const q = query(importsRef, where('fileHash', '==', fileHash), where('isActive', '==', true));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
        return null;
    }
    const doc = querySnapshot.docs[0];
    const data = doc.data() as ImportFirestore;
    return {
        ...data,
        id: doc.id,
        createdAt: (data.createdAt as Timestamp).toDate(),
        statementStartDate: data.statementStartDate ? (data.statementStartDate as Timestamp).toDate() : undefined,
        statementEndDate: data.statementEndDate ? (data.statementEndDate as Timestamp).toDate() : undefined,
    } as Import;
}


export async function saveImportedTransactions(
    userId: string,
    importId: string,
    transactionsToImport: {id: string, data: Omit<Transaction, 'id' | 'userId' | 'importIds' | 'createdAt' | 'updatedAt'>}[]
): Promise<{ success: boolean; error?: string; savedCount: number; duplicatesIgnored: number }> {
  
  if (!userId) {
    return { success: false, error: 'Authentication required.', savedCount: 0, duplicatesIgnored: 0 };
  }

  const batch = writeBatch(firestore);
  const transactionsCollectionRef = collection(firestore, 'users', userId, 'transactions');

  let newTransactionsCount = 0;
  let duplicatesCount = 0;

  for (const tx of transactionsToImport) {
    const docRef = doc(transactionsCollectionRef, tx.id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        // Document exists, it's a duplicate. Update it.
        batch.update(docRef, {
            importIds: arrayUnion(importId),
            updatedAt: serverTimestamp()
        });
        duplicatesCount++;
    } else {
        // Document does not exist, it's new. Create it.
        const dataToSave = {
            ...tx.data,
            userId: userId,
            importIds: [importId],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };
        batch.set(docRef, dataToSave);
        newTransactionsCount++;
    }
  }


  if (newTransactionsCount === 0 && duplicatesCount === 0) {
    return { success: true, savedCount: 0, duplicatesIgnored: 0 };
  }

  try {
    await batch.commit();
    return { success: true, savedCount: newTransactionsCount, duplicatesIgnored: duplicatesCount };
  } catch (error: any) {
    console.error("Firestore batch commit error:", error);
    if (error.code === 'permission-denied') {
        const permissionError = new FirestorePermissionError({
            path: transactionsCollectionRef.path,
            operation: 'write',
        });
        errorEmitter.emit('permission-error', permissionError);
        return { success: false, error: 'Authentication required.', savedCount: 0, duplicatesIgnored: 0 };
    }
    return { success: false, error: `No se pudieron guardar las transacciones: ${error.message}`, savedCount: 0, duplicatesIgnored: transactionsToImport.length };
  }
}

export async function updateTransactionCategory(
  userId: string,
  txId: string,
  newCategory: string
): Promise<{ success: boolean; error?: string }> {
  if (!userId) {
    return { success: false, error: 'Authentication required.' };
  }

  const docRef = doc(firestore, 'users', userId, 'transactions', txId);

  try {
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      return { success: false, error: 'Transaction not found.' };
    }

    const isTransfer = newCategory === 'transfer';
    const currentDirection = docSnap.data().direction;
    let type: 'income' | 'expense' | 'transfer' = 'expense'; // Default
    if (isTransfer) {
        type = 'transfer';
    } else if (currentDirection === 'credit') {
        type = 'income';
    }

    await updateDoc(docRef, {
      category: newCategory,
      isTransfer,
      type,
      updatedAt: serverTimestamp(),
    });

    return { success: true };
  } catch (error: any) {
    console.error('Firestore category update error:', error);
    if (error.code === 'permission-denied') {
      const permissionError = new FirestorePermissionError({
        path: docRef.path,
        operation: 'update',
      });
      errorEmitter.emit('permission-error', permissionError);
      return { success: false, error: 'Authentication required.' };
    }
    return { success: false, error: `Could not update category: ${error.message}` };
  }
}


export async function getUserBudgets(userId: string, period: string): Promise<Budget[]> {
  if (!userId) {
    return [];
  }
  try {
    const budgetsCollection = collection(firestore, 'users', userId, 'budgets');
    const q = query(budgetsCollection, where('period', '==', period));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as Budget) }));
  } catch (error) {
    console.error('Error fetching budgets:', error);
    return [];
  }
}

export async function saveBudget(userId: string, budget: Omit<Budget, 'id'>) {
   if (!userId) {
    throw new Error('User not authenticated');
  }
  // The document ID will be `${period}-${category}`
  const budgetId = `${budget.period}-${budget.category}`;
  const budgetRef = doc(firestore, 'users', userId, 'budgets', budgetId);
  await setDoc(budgetRef, {
    ...budget,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

export async function cleanupDuplicateTransactions(userId: string): Promise<{
  success: boolean;
  error?: string;
  totalChecked: number;
  duplicatesFound: number;
  duplicatesDeleted: number;
}> {
    if (!userId) {
        return { success: false, error: "Usuario no autenticado.", totalChecked: 0, duplicatesFound: 0, duplicatesDeleted: 0 };
    }

    try {
        const transactions = await getUserTransactions(userId);
        if (transactions.length === 0) {
            return { success: true, totalChecked: 0, duplicatesFound: 0, duplicatesDeleted: 0 };
        }

        const contentFingerprints = new Map<string, Transaction[]>();
        for (const tx of transactions) {
             const datePart = tx.date instanceof Date ? tx.date.toISOString().split('T')[0] : String(tx.date).split('T')[0];
             const amount = tx.direction === 'debit' ? -tx.amount : tx.amount;
             const fingerprintString = `${datePart}|${amount}|${tx.descriptionRaw}`;
             const fingerprint = await createTransactionHash(fingerprintString);
             if (!contentFingerprints.has(fingerprint)) {
                contentFingerprints.set(fingerprint, []);
             }
             contentFingerprints.get(fingerprint)!.push(tx);
        }

        const batch = writeBatch(firestore);
        let duplicatesDeleted = 0;

        for (const txs of contentFingerprints.values()) {
            if (txs.length > 1) {
                const sortedTxs = txs.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
                const txsToDelete = sortedTxs.slice(1);
                
                duplicatesDeleted += txsToDelete.length;

                for (const tx of txsToDelete) {
                    const docRef = doc(firestore, 'users', userId, 'transactions', tx.id);
                    batch.delete(docRef);
                }
            }
        }


        if (duplicatesDeleted > 0) {
            await batch.commit();
        }

        return {
            success: true,
            totalChecked: transactions.length,
            duplicatesFound: duplicatesDeleted, // Correctly report what was found and will be deleted
            duplicatesDeleted: duplicatesDeleted,
        };

    } catch (error: any) {
        console.error("Error cleaning up duplicates:", error);
        return {
            success: false,
            error: error.message,
            totalChecked: 0,
            duplicatesFound: 0,
            duplicatesDeleted: 0,
        };
    }
}


export async function getUserImports(userId: string): Promise<Import[]> {
    if (!userId) return [];

    try {
        const importsCollection = collection(firestore, 'users', userId, 'imports');
        const q = query(importsCollection, where('isActive', '==', true), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        
        return querySnapshot.docs.map(doc => {
            const data = doc.data() as ImportFirestore;
            return {
                ...data,
                id: doc.id,
                createdAt: (data.createdAt as Timestamp).toDate(),
                statementStartDate: data.statementStartDate ? (data.statementStartDate as Timestamp).toDate() : undefined,
                statementEndDate: data.statementEndDate ? (data.statementEndDate as Timestamp).toDate() : undefined,
            } as Import;
        });

    } catch(e) {
        console.error("Error fetching imports:", e);
        return [];
    }
}


export async function deleteImportAndTransactions(userId: string, importId: string): Promise<{success: boolean, error?: string, deletedCount: number}> {
    if (!userId) {
        return { success: false, error: "Authentication required.", deletedCount: 0 };
    }
    
    try {
        const batch = writeBatch(firestore);
        
        // 1. Find all transactions associated with this import
        const txCollectionRef = collection(firestore, 'users', userId, 'transactions');
        const q = query(txCollectionRef, where('importIds', 'array-contains', importId));
        const querySnapshot = await getDocs(q);
        
        let deletedCount = 0;
        querySnapshot.forEach(docSnap => {
            const txData = docSnap.data();
            const tx = { id: docSnap.id, ...txData } as Transaction;

            if (tx.importIds && tx.importIds.length === 1 && tx.importIds[0] === importId) {
                // If this is the only import it belongs to, delete the whole transaction document
                batch.delete(docSnap.ref);
                deletedCount++;
            } else {
                // If it belongs to other imports, just remove this importId from the array
                batch.update(docSnap.ref, {
                    importIds: arrayRemove(importId)
                });
            }
        });

        // 2. Soft delete the import document itself by setting isActive to false
        const importDocRef = doc(firestore, 'users', userId, 'imports', importId);
        batch.update(importDocRef, { isActive: false });

        // 3. Commit the batch
        await batch.commit();

        return { success: true, deletedCount: deletedCount };

    } catch(e: any) {
        console.error("Error deleting import:", e);
        if (e.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
                path: `users/${userId}/imports/${importId}`,
                operation: 'delete',
            });
            errorEmitter.emit('permission-error', permissionError);
             return { success: false, error: 'Authentication required.', deletedCount: 0 };
        }
        return { success: false, error: e.message, deletedCount: 0 };
    }
}

export async function saveUserProfile(userId: string, profile: Omit<UserProfile, 'userId' | 'selectedAt'>): Promise<void> {
  const ref = doc(firestore, 'users', userId, 'profile', 'main');
  await setDoc(ref, {
    userId,
    businessType: profile.businessType,
    hasEmployees: profile.hasEmployees,
    selectedAt: serverTimestamp(),
  });
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const ref = doc(firestore, 'users', userId, 'profile', 'main');
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    userId: data.userId,
    businessType: data.businessType,
    hasEmployees: data.hasEmployees,
    selectedAt: (data.selectedAt as Timestamp).toDate(),
  };
}
