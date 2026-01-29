"""
Firebase Firestore integration for persisting extracted data
"""

import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
from datetime import datetime
from typing import List, Dict, Any
import logging
import json
from pathlib import Path
import os

logger = logging.getLogger(__name__)

# Initialize Firebase
db = None

try:
    # Check if Firebase is already initialized
    firebase_admin.get_app()
    db = firestore.client()
    logger.info("✅ Firebase já inicializado")
except ValueError:
    # Firebase not initialized, try to initialize
    try:
        # Try to load from environment variable first (Render)
        firebase_creds_env = os.getenv("FIREBASE_CREDENTIALS")
        if firebase_creds_env:
            creds_dict = json.loads(firebase_creds_env)
            creds = credentials.Certificate(creds_dict)
            firebase_admin.initialize_app(creds)
            db = firestore.client()
            logger.info("✅ Firebase initialized com environment variable")
        else:
            # Fallback to local file
            creds_path = Path(__file__).parent / "firebase_credentials.json"
            if creds_path.exists():
                creds = credentials.Certificate(str(creds_path))
                firebase_admin.initialize_app(creds)
                db = firestore.client()
                logger.info("✅ Firebase initialized com credentials file")
            else:
                logger.error("❌ firebase_credentials.json não encontrado e FIREBASE_CREDENTIALS não definido!")
                raise FileNotFoundError("firebase_credentials.json não encontrado")
    except Exception as e:
        logger.error(f"❌ Firebase initialization failed: {e}")
        db = None
except Exception as e:
    logger.error(f"❌ Error initializing Firebase: {e}")
    db = None


class OrcamentoFirestore:
    """Manage Orçamento data in Firestore"""
    
    COLLECTION = "orcamentos"
    
    @staticmethod
    def save_orcamento(
        upload_id: str,
        filename: str,
        tables: List[Dict[str, Any]],
        items_data: Dict[str, Any] = None,
    ) -> str:
        """
        Save extracted PDF data to Firestore
        
        Args:
            upload_id: Unique upload identifier
            filename: Original PDF filename
            tables: Extracted tables from PDF
            items_data: Parsed items data (optional)
            
        Returns:
            Document ID in Firestore
        """
        if not db:
            logger.error("❌ Firestore not initialized")
            raise Exception("Firestore not available")
        
        try:
            doc_data = {
                "uploadId": upload_id,
                "filename": filename,
                "uploadedAt": datetime.now(),
                "extractedAt": datetime.now(),
                "tables": tables,
                "itemsData": items_data or {},
                "tablesFound": len(tables),
                "status": "completed",
            }
            
            # Add document to collection
            db.collection("orcamentos").add(doc_data)
            logger.info(f"✅ Orçamento salvo no Firebase: {upload_id}")
            return upload_id
            
        except Exception as e:
            logger.error(f"❌ Erro ao salvar no Firestore: {str(e)}")
            raise
    
    @staticmethod
    def get_orcamento_by_upload_id(upload_id: str) -> Dict[str, Any]:
        """
        Get orçamento by upload ID
        
        Args:
            upload_id: Upload identifier
            
        Returns:
            Orçamento document or None
        """
        if not db:
            return None
        
        try:
            docs = db.collection("orcamentos").where(
                "uploadId", "==", upload_id
            ).stream()
            
            for doc in docs:
                return {
                    "id": doc.id,
                    **doc.to_dict()
                }
            
            return None
            
        except Exception as e:
            logger.error(f"❌ Erro ao buscar orçamento: {str(e)}")
            return None
    
    @staticmethod
    def list_all_orcamentos() -> List[Dict[str, Any]]:
        """
        List all orçamentos
        
        Returns:
            List of orçamento documents
        """
        if not db:
            return []
        
        try:
            docs = db.collection("orcamentos").stream()
            return [
                {
                    "id": doc.id,
                    **doc.to_dict()
                }
                for doc in docs
            ]
            
        except Exception as e:
            logger.error(f"❌ Erro ao listar orçamentos: {str(e)}")
            return []
    
    @staticmethod
    def update_orcamento(doc_id: str, data: Dict[str, Any]) -> bool:
        """
        Update orçamento document
        
        Args:
            doc_id: Document ID
            data: Data to update
            
        Returns:
            Success status
        """
        if not db:
            return False
        
        try:
            data["updatedAt"] = datetime.now()
            db.collection("orcamentos").document(doc_id).update(data)
            logger.info(f"✅ Orçamento atualizado: {doc_id}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Erro ao atualizar orçamento: {str(e)}")
            return False
    
    @staticmethod
    def delete_orcamento(doc_id: str) -> bool:
        """
        Delete orçamento document
        
        Args:
            doc_id: Document ID
            
        Returns:
            Success status
        """
        if not db:
            return False
        
        try:
            db.collection("orcamentos").document(doc_id).delete()
            logger.info(f"✅ Orçamento deletado: {doc_id}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Erro ao deletar orçamento: {str(e)}")
            return False
