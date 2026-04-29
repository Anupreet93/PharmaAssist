// src/components/ChatWindow.jsx - FIXED VERSION
import React, { useContext, useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import PropTypes from 'prop-types';
import debounce from 'lodash/debounce';
import { MyContext } from "./MyContext.jsx";
import { AuthContext } from "./context/AuthContext.jsx";
import api from "./lib/api.js";
import { ScaleLoader } from "react-spinners";

/**
 * Custom hook for speech recognition functionality
 */
const useSpeechRecognition = (setPrompt) => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const recognitionRef = useRef(null);
  const finalTranscriptRef = useRef("");

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition 
      || window.webkitSpeechRecognition
      || window.mozSpeechRecognition
      || window.msSpeechRecognition
      || window.oSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn("Speech recognition not supported in this browser");
      setIsSpeechSupported(false);
      return;
    }

    setIsSpeechSupported(true);
    
    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        console.log("Speech recognition started");
        setIsListening(true);
        setPermissionDenied(false);
        finalTranscriptRef.current = "";
      };

      recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        const combinedText = finalTranscriptRef.current + finalTranscript + interimTranscript;
        setPrompt(combinedText);
        
        if (finalTranscript) {
          finalTranscriptRef.current += finalTranscript + ' ';
        }
      };

      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
        
        switch(event.error) {
          case 'not-allowed':
          case 'permission-denied':
            setPermissionDenied(true);
            alert('Microphone access denied. Please allow microphone permissions in your browser settings.');
            break;
          case 'audio-capture':
            alert('No microphone found. Please ensure a microphone is connected.');
            break;
          case 'network':
            alert('Network error occurred during speech recognition.');
            break;
          case 'no-speech':
            alert('No speech detected. Please try again.');
            break;
          default:
            alert('Speech recognition error. Please try again.');
        }
      };

      recognition.onend = () => {
        console.log("Speech recognition ended");
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } catch (error) {
      console.error("Failed to initialize speech recognition:", error);
      setIsSpeechSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
          recognitionRef.current.onresult = null;
          recognitionRef.current.onerror = null;
          recognitionRef.current.onend = null;
          recognitionRef.current.onstart = null;
        } catch (e) {
          console.warn("Error cleaning up speech recognition:", e);
        }
        recognitionRef.current = null;
      }
    };
  }, [setPrompt]);

  // Check microphone permission
  const checkMicrophonePermission = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return false;
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      console.error('Microphone permission denied:', error);
      setPermissionDenied(true);
      return false;
    }
  }, []);

  const toggleMicrophone = useCallback(async () => {
    if (!isSpeechSupported) {
      alert("Speech recognition is not supported in your browser. Please use Chrome, Edge, or Safari.");
      return;
    }

    if (!recognitionRef.current) {
      alert("Speech recognition not initialized. Please refresh the page.");
      return;
    }

    if (permissionDenied) {
      const confirmReset = window.confirm(
        "Microphone permission was previously denied. Would you like to reset permissions and try again?"
      );
      if (confirmReset) {
        setPermissionDenied(false);
        alert("Please update microphone permissions in your browser settings and refresh the page.");
      }
      return;
    }

    if (isListening) {
      try {
        recognitionRef.current.stop();
      } catch (error) {
        console.error("Error stopping recognition:", error);
      }
      setIsListening(false);
    } else {
      const hasPermission = await checkMicrophonePermission();
      if (!hasPermission) {
        alert("Microphone permission is required for voice input. Please grant permission and try again.");
        return;
      }

      try {
        finalTranscriptRef.current = "";
        setPrompt("");
        recognitionRef.current.start();
      } catch (error) {
        console.error("Error starting recognition:", error);
        alert("Could not start microphone. Please ensure microphone permissions are granted.");
      }
    }
  }, [isSpeechSupported, isListening, permissionDenied, checkMicrophonePermission, setPrompt]);

  return {
    isListening,
    isSpeechSupported,
    permissionDenied,
    toggleMicrophone
  };
};

/**
 * PricingCard component for displaying pricing and generic alternatives
 */
const PricingCard = React.memo(({ data }) => {
  if (!data || (!data.brand_pricing?.length && !data.generic_alternatives?.length)) {
    return null;
  }

  return (
    <div className="bg-white p-6 rounded-2xl shadow-lg border border-green-200 space-y-6 mt-6" role="article" aria-label="Pricing and generics information">
      {/* Header */}
      <header className="flex items-center gap-4 pb-4 border-b border-green-100">
        <div className="bg-green-600 p-3 rounded-xl" aria-hidden="true">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Pricing & Generic Alternatives</h2>
          <p className="text-green-700 font-medium">Cost-effective options and availability</p>
        </div>
      </header>

      {/* Price Range */}
      {data.price_range && (
        <section className="bg-green-50 p-4 rounded-xl border border-green-100" aria-labelledby="price-range-heading">
          <h3 id="price-range-heading" className="font-semibold text-green-800 mb-3">Price Range</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-sm text-gray-600">Minimum</p>
              <p className="text-2xl font-bold text-green-700">{data.price_range.min}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Average</p>
              <p className="text-2xl font-bold text-blue-700">{data.price_range.average}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Maximum</p>
              <p className="text-2xl font-bold text-purple-700">{data.price_range.max}</p>
            </div>
          </div>
        </section>
      )}

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Brand Pricing */}
        {data.brand_pricing?.length > 0 && (
          <section className="bg-blue-50 p-4 rounded-xl border border-blue-100" aria-labelledby="brand-pricing-heading">
            <div className="flex items-center gap-2 mb-4">
              <div className="bg-blue-500 p-1 rounded" aria-hidden="true">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 id="brand-pricing-heading" className="font-semibold text-blue-800">Brand Options</h3>
            </div>
            
            <div className="space-y-4">
              {data.brand_pricing.map((brand, index) => (
                <div key={index} className="bg-white p-4 rounded-lg border border-blue-100">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-gray-900">{brand.brand}</h4>
                    <span className="text-xl font-bold text-green-700">{brand.price}</span>
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p><span className="font-medium">Form:</span> {brand.form}</p>
                    <p><span className="font-medium">Manufacturer:</span> {brand.manufacturer}</p>
                    <p><span className="font-medium">Package:</span> {brand.package_size}</p>
                    <p><span className="font-medium">Availability:</span> {brand.availability}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Generic Alternatives */}
        {data.generic_alternatives?.length > 0 && (
          <section className="bg-purple-50 p-4 rounded-xl border border-purple-100" aria-labelledby="generics-heading">
            <div className="flex items-center gap-2 mb-4">
              <div className="bg-purple-500 p-1 rounded" aria-hidden="true">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 id="generics-heading" className="font-semibold text-purple-800">Generic Alternatives</h3>
            </div>
            
            <div className="space-y-4">
              {data.generic_alternatives.map((generic, index) => (
                <div key={index} className="bg-white p-4 rounded-lg border border-purple-100">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-medium text-gray-900">{generic.name}</h4>
                      <p className="text-sm text-purple-600">Bioequivalence: {generic.bioequivalence}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xl font-bold text-green-700">{generic.price}</span>
                      {generic.savings && (
                        <p className="text-sm text-green-600">Save: {generic.savings}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p><span className="font-medium">Form:</span> {generic.form}</p>
                    <p><span className="font-medium">Manufacturer:</span> {generic.manufacturer}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Pharmacy Availability */}
      {data.pharmacy_availability?.length > 0 && (
        <section className="bg-orange-50 p-4 rounded-xl border border-orange-100" aria-labelledby="pharmacy-heading">
          <h3 id="pharmacy-heading" className="font-semibold text-orange-800 mb-3">Pharmacy Availability</h3>
          <div className="flex flex-wrap gap-2">
            {data.pharmacy_availability.map((pharmacy, index) => (
              <span key={index} className="bg-white text-orange-700 px-3 py-1.5 rounded-full text-sm border border-orange-200">
                {pharmacy}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Cost-Saving Tips */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4" role="note">
        <div className="flex items-start gap-3">
          <div className="bg-yellow-100 p-2 rounded-lg flex-shrink-0" aria-hidden="true">
            <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-yellow-800 mb-1">Cost-Saving Tips</h3>
            <ul className="text-sm text-yellow-700 space-y-1">
              <li className="flex items-start gap-2">
                <span className="text-yellow-600 mt-1" aria-hidden="true">•</span>
                <span>Ask your doctor about generic alternatives to save costs</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-600 mt-1" aria-hidden="true">•</span>
                <span>Check with multiple pharmacies for best pricing</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-600 mt-1" aria-hidden="true">•</span>
                <span>Consider patient assistance programs if eligible</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-600 mt-1" aria-hidden="true">•</span>
                <span>Ask about 90-day supplies for maintenance medications</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
});

PricingCard.propTypes = {
  data: PropTypes.shape({
    brand_pricing: PropTypes.arrayOf(
      PropTypes.shape({
        brand: PropTypes.string,
        price: PropTypes.string,
        form: PropTypes.string,
        manufacturer: PropTypes.string,
        package_size: PropTypes.string,
        availability: PropTypes.string
      })
    ),
    generic_alternatives: PropTypes.arrayOf(
      PropTypes.shape({
        name: PropTypes.string,
        price: PropTypes.string,
        form: PropTypes.string,
        manufacturer: PropTypes.string,
        bioequivalence: PropTypes.string,
        savings: PropTypes.string
      })
    ),
    price_range: PropTypes.shape({
      min: PropTypes.string,
      max: PropTypes.string,
      average: PropTypes.string
    }),
    pharmacy_availability: PropTypes.arrayOf(PropTypes.string)
  })
};

/**
 * MedicineCard component for displaying structured medication information
 */
const MedicineCard = React.memo(({ data }) => {
  if (!data || typeof data !== 'object') {
    return (
      <div className="bg-white p-6 rounded-2xl shadow-lg border border-blue-200">
        <p className="text-gray-600">Unable to display medicine information</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-2xl shadow-lg border border-blue-200 space-y-6" role="article" aria-label="Medicine information">
      {/* Header */}
      <header className="flex items-center gap-4 pb-4 border-b border-blue-100">
        <div className="bg-blue-600 p-3 rounded-xl" aria-hidden="true">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{data.name || "Unknown Medicine"}</h2>
          {data.formulation && (
            <p className="text-blue-700 font-medium">{data.formulation}</p>
          )}
          {data.category && (
            <p className="text-gray-600 text-sm mt-1">Category: {data.category}</p>
          )}
        </div>
      </header>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Uses */}
        <section className="bg-blue-50 p-4 rounded-xl border border-blue-100" aria-labelledby="uses-heading">
          <div className="flex items-center gap-2 mb-3">
            <div className="bg-blue-500 p-1 rounded" aria-hidden="true">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 id="uses-heading" className="font-semibold text-blue-800">Therapeutic Uses</h3>
          </div>
          <ul className="space-y-1" aria-label="List of therapeutic uses">
            {Array.isArray(data.uses) && data.uses.length > 0 ? data.uses.map((use, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-blue-500 mt-1" aria-hidden="true">•</span>
                <span>{use}</span>
              </li>
            )) : <li className="text-gray-500 text-sm">No uses specified</li>}
          </ul>
        </section>

        {/* Side Effects */}
        <section className="bg-red-50 p-4 rounded-xl border border-red-100" aria-labelledby="side-effects-heading">
          <div className="flex items-center gap-2 mb-3">
            <div className="bg-red-500 p-1 rounded" aria-hidden="true">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 id="side-effects-heading" className="font-semibold text-red-800">Side Effects</h3>
          </div>
          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-medium text-red-700 mb-1">Common:</h4>
              <ul className="text-sm text-gray-700" aria-label="List of common side effects">
                {Array.isArray(data.common_side_effects) && data.common_side_effects.length > 0 ?
                  data.common_side_effects.map((effect, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-red-400 mt-1" aria-hidden="true">•</span>
                      <span>{effect}</span>
                    </li>
                  )) :
                  <li className="text-gray-500">None specified</li>
                }
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-medium text-red-700 mb-1">Serious:</h4>
              <ul className="text-sm text-gray-700" aria-label="List of serious side effects">
                {Array.isArray(data.serious_side_effects) && data.serious_side_effects.length > 0 ?
                  data.serious_side_effects.map((effect, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-red-600 mt-1" aria-hidden="true">•</span>
                      <span>{effect}</span>
                    </li>
                  )) :
                  <li className="text-gray-500">None specified</li>
                }
              </ul>
            </div>
          </div>
        </section>
      </div>

      {/* Additional Information */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Contraindications */}
        <section className="bg-purple-50 p-4 rounded-xl border border-purple-100" aria-labelledby="contraindications-heading">
          <h3 id="contraindications-heading" className="font-semibold text-purple-800 mb-2 text-sm">Contraindications</h3>
          <ul className="space-y-1" aria-label="List of contraindications">
            {Array.isArray(data.contraindications) && data.contraindications.length > 0 ?
              data.contraindications.map((item, i) => (
                <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                  <span className="text-purple-500 mt-1" aria-hidden="true">•</span>
                  <span>{item}</span>
                </li>
              )) :
              <li className="text-gray-500 text-sm">None specified</li>
            }
          </ul>
        </section>

        {/* Age Groups */}
        <section className="bg-green-50 p-4 rounded-xl border border-green-100" aria-labelledby="age-groups-heading">
          <h3 id="age-groups-heading" className="font-semibold text-green-800 mb-2 text-sm">Safe Age Groups</h3>
          <div className="flex flex-wrap gap-2" role="list" aria-label="List of safe age groups">
            {Array.isArray(data.safe_age_groups) && data.safe_age_groups.length > 0 ?
              data.safe_age_groups.map((group, i) => (
                <span key={i} className="bg-white text-green-700 px-3 py-1 rounded-full text-xs border border-green-200" role="listitem">
                  {group}
                </span>
              )) :
              <span className="text-gray-500 text-sm">All ages</span>
            }
          </div>
        </section>

        {/* Prescription */}
        <section className="bg-orange-50 p-4 rounded-xl border border-orange-100" aria-labelledby="prescription-heading">
          <h3 id="prescription-heading" className="font-semibold text-orange-800 mb-2 text-sm">Prescription</h3>
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg ${data.prescription_required ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            <span className="font-medium">
              {data.prescription_required ? 'Prescription Required' : 'Over the Counter'}
            </span>
          </div>
        </section>
      </div>

      {/* Storage & Pregnancy Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.storage_instructions && (
          <section className="bg-blue-50 p-4 rounded-xl border border-blue-100" aria-labelledby="storage-heading">
            <h3 id="storage-heading" className="font-semibold text-blue-800 mb-2 text-sm">Storage Instructions</h3>
            <p className="text-sm text-gray-700">{data.storage_instructions}</p>
          </section>
        )}
        {data.pregnancy_and_lactation && (
          <section className="bg-pink-50 p-4 rounded-xl border border-pink-100" aria-labelledby="pregnancy-heading">
            <h3 id="pregnancy-heading" className="font-semibold text-pink-800 mb-2 text-sm">Pregnancy & Lactation</h3>
            <p className="text-sm text-gray-700">{data.pregnancy_and_lactation}</p>
          </section>
        )}
      </div>

      {/* Additional Medicine Information */}
      {(data.dosage || data.mechanism_of_action || data.drug_interactions?.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.dosage && data.dosage !== "Consult your healthcare provider" && (
            <section className="bg-indigo-50 p-4 rounded-xl border border-indigo-100" aria-labelledby="dosage-heading">
              <h3 id="dosage-heading" className="font-semibold text-indigo-800 mb-2 text-sm">Recommended Dosage</h3>
              <p className="text-sm text-gray-700">{data.dosage}</p>
            </section>
          )}
          {data.mechanism_of_action && data.mechanism_of_action !== "Not specified" && (
            <section className="bg-teal-50 p-4 rounded-xl border border-teal-100" aria-labelledby="moa-heading">
              <h3 id="moa-heading" className="font-semibold text-teal-800 mb-2 text-sm">Mechanism of Action</h3>
              <p className="text-sm text-gray-700">{data.mechanism_of_action}</p>
            </section>
          )}
        </div>
      )}

      {/* Drug Interactions */}
      {Array.isArray(data.drug_interactions) && data.drug_interactions.length > 0 && (
        <section className="bg-amber-50 p-4 rounded-xl border border-amber-100" aria-labelledby="interactions-heading">
          <h3 id="interactions-heading" className="font-semibold text-amber-800 mb-2 text-sm">Drug Interactions</h3>
          <ul className="space-y-1" aria-label="List of drug interactions">
            {data.drug_interactions.map((interaction, i) => (
              <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                <span className="text-amber-500 mt-1" aria-hidden="true">•</span>
                <span>{interaction}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Disclaimer */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4" role="alert" aria-labelledby="disclaimer-heading">
        <div className="flex items-start gap-3">
          <div className="bg-yellow-100 p-2 rounded-lg flex-shrink-0" aria-hidden="true">
            <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <div>
            <h3 id="disclaimer-heading" className="font-semibold text-yellow-800 mb-1 text-sm">Important Disclaimer</h3>
            <p className="text-sm text-yellow-700">
              {data.disclaimer || "This information is for educational purposes only. Always consult with a healthcare professional before taking any medication."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
});

MedicineCard.propTypes = {
  data: PropTypes.shape({
    name: PropTypes.string,
    formulation: PropTypes.string,
    category: PropTypes.string,
    uses: PropTypes.arrayOf(PropTypes.string),
    common_side_effects: PropTypes.arrayOf(PropTypes.string),
    serious_side_effects: PropTypes.arrayOf(PropTypes.string),
    contraindications: PropTypes.arrayOf(PropTypes.string),
    safe_age_groups: PropTypes.arrayOf(PropTypes.string),
    pregnancy_and_lactation: PropTypes.string,
    storage_instructions: PropTypes.string,
    prescription_required: PropTypes.bool,
    disclaimer: PropTypes.string,
    dosage: PropTypes.string,
    mechanism_of_action: PropTypes.string,
    drug_interactions: PropTypes.arrayOf(PropTypes.string),
    warnings: PropTypes.arrayOf(PropTypes.string),
    half_life: PropTypes.string
  })
};

/**
 * MessageSkeleton component for loading states
 */
const MessageSkeleton = () => (
  <div className="animate-pulse" aria-label="Loading message">
    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
  </div>
);

/**
 * InputArea component for user input with microphone
 */
const InputArea = React.memo(({ 
  prompt, 
  setPrompt, 
  getReply, 
  loading, 
  isListening, 
  isSpeechSupported,
  permissionDenied,
  toggleMicrophone,
  debouncedGetReply 
}) => {
  const handleInputChange = (e) => {
    setPrompt(e.target.value);
    debouncedGetReply.cancel();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      debouncedGetReply.cancel();
      getReply();
    }
  };

  return (
    <div className="bg-white border-t border-blue-200 shadow-lg">
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex flex-col sm:flex-row items-end gap-4">
          <div className="flex-1 w-full">
            <label htmlFor="chat-input" className="block text-sm font-medium text-gray-700 mb-2">Medication Query</label>
            <div className="relative">
              {/* Enhanced Microphone Button */}
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2 z-10">
                <button
                  onClick={toggleMicrophone}
                  type="button"
                  aria-pressed={isListening}
                  aria-label={isListening ? "Stop recording" : "Start voice recording"}
                  disabled={!isSpeechSupported}
                  title={isSpeechSupported ? (isListening ? "Stop listening" : "Start voice input") : "Speech recognition not supported"}
                  className={`w-10 h-10 rounded-full flex items-center justify-center focus:outline-none transition-all duration-300 ${
                    isListening 
                      ? "bg-red-500 text-white shadow-lg shadow-red-200 animate-pulse" 
                      : permissionDenied
                      ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                      : "bg-blue-100 text-blue-600 hover:bg-blue-200"
                  }`}
                >
                  {isListening ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1zm4 0a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Voice Listening Indicator */}
              {isListening && (
                <div className="absolute left-14 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                  <div className="flex space-x-1">
                    <div className="w-1 h-4 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-1 h-6 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '100ms' }}></div>
                    <div className="w-1 h-4 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '200ms' }}></div>
                  </div>
                  <span className="text-xs font-medium text-red-600">Listening...</span>
                </div>
              )}

              <input
                id="chat-input"
                type="text"
                value={prompt}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={isListening ? "Speak now..." : "Search any medicine, disease, or query..."}
                className={`w-full bg-white text-gray-900 placeholder-gray-500 px-14 py-4 rounded-xl border-2 focus:outline-none transition-all duration-300 ${
                  isListening 
                    ? 'border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-100' 
                    : 'border-blue-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100'
                }`}
                aria-label="Ask about medications"
                disabled={loading}
                aria-describedby="input-help"
              />
              
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
            
            <div className="mt-2 flex justify-between items-center">
              <p id="input-help" className="text-xs text-gray-500">
                Examples: "side effects of aspirin", "drug interactions with warfarin", "pediatric dosage for amoxicillin"
              </p>
              {!isSpeechSupported && (
                <p className="text-xs text-amber-600">
                  <svg className="w-3 h-3 inline mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Voice input not supported
                </p>
              )}
              {permissionDenied && (
                <p className="text-xs text-amber-600">
                  <svg className="w-3 h-3 inline mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                  </svg>
                  Microphone permission required
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('new-chat'));
              }}
              className="inline-flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 px-6 py-4 rounded-xl border-2 border-gray-300 hover:border-gray-400 transition-colors font-medium"
              disabled={loading}
              aria-label="Start new chat"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span>New Chat</span>
            </button>

            <button
              onClick={() => {
                debouncedGetReply.cancel();
                getReply();
              }}
              disabled={loading || !prompt?.trim()}
              className="inline-flex items-center gap-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-4 rounded-xl font-semibold transition-colors shadow-lg hover:shadow-xl"
              aria-label="Search medication database"
            >
              {loading ? (
                <>
                  <ScaleLoader color="#ffffff" height={16} width={2} />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                  </svg>
                  <span>Search Database</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

InputArea.propTypes = {
  prompt: PropTypes.string,
  setPrompt: PropTypes.func.isRequired,
  getReply: PropTypes.func.isRequired,
  loading: PropTypes.bool,
  isListening: PropTypes.bool,
  isSpeechSupported: PropTypes.bool,
  permissionDenied: PropTypes.bool,
  toggleMicrophone: PropTypes.func.isRequired,
  debouncedGetReply: PropTypes.object.isRequired
};

/**
 * Main ChatWindow Component
 */
function ChatWindow() {
  const {
    prompt,
    setPrompt,
    reply,
    setReply,
    currThreadId,
    setCurrThreadId,
    newChat,
    setNewChat,
    prevChats,
    setPrevChats,
    allThreads,
    setAllThreads
  } = useContext(MyContext);

  const { user, signOut } = useContext(AuthContext);
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [recentOpen, setRecentOpen] = useState(true);
  const [fetchingThreads, setFetchingThreads] = useState(false);
  const [searchHistory, setSearchHistory] = useState([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Use custom speech recognition hook
  const { 
    isListening, 
    isSpeechSupported, 
    permissionDenied, 
    toggleMicrophone 
  } = useSpeechRecognition(setPrompt);

  // Online status detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // JSON helpers & parsing
  const tryParseJSON = useCallback((str) => {
    if (typeof str !== "string") return str;
    try {
      const parsed = JSON.parse(str);
      return parsed;
    } catch {
      return str;
    }
  }, []);

  // Normalize pricing data
  const normalizePricingData = useCallback((data) => {
    if (!data) {
      return {
        brand_pricing: [],
        generic_alternatives: [],
        price_range: { min: "N/A", max: "N/A", average: "N/A" },
        pharmacy_availability: []
      };
    }

    const normalized = {
      brand_pricing: Array.isArray(data.brand_pricing) 
        ? data.brand_pricing.map(item => ({
            brand: item.brand || item.name || "Unknown Brand",
            price: item.price || "Not available",
            form: item.form || item.formulation || "N/A",
            manufacturer: item.manufacturer || "Not specified",
            package_size: item.package_size || item.quantity || "N/A",
            availability: item.availability || item.stock_status || "Unknown"
          }))
        : [],
      
      generic_alternatives: Array.isArray(data.generic_alternatives) 
        ? data.generic_alternatives.map(item => ({
            name: item.name || item.generic_name || "Unknown Generic",
            price: item.price || "Not available",
            form: item.form || item.formulation || "N/A",
            manufacturer: item.manufacturer || "Not specified",
            bioequivalence: item.bioequivalence || item.equivalence || "Unknown",
            savings: item.savings || item.price_difference || "N/A"
          }))
        : [],
      
      price_range: data.price_range || {
        min: data.min_price || "N/A",
        max: data.max_price || "N/A",
        average: data.average_price || "N/A"
      },
      
      pharmacy_availability: Array.isArray(data.pharmacy_availability) 
        ? data.pharmacy_availability
        : []
    };

    return normalized;
  }, []);

  // Normalize medicine data
  const normalizeMedicineData = useCallback((data) => {
    const normalized = {
      name: data.name || data.medicine_name || data.drug_name || "Unknown Medicine",
      formulation: data.formulation || data.form || data.dosage_form || "",
      category: data.category || data.class || data.type || "",
      uses: Array.isArray(data.uses) ? data.uses :
            (data.uses ? [data.uses] : ["No uses specified"]),
      common_side_effects: Array.isArray(data.common_side_effects) ? data.common_side_effects :
                          Array.isArray(data.side_effects) ? data.side_effects :
                          (data.side_effects ? [data.side_effects] : ["No common side effects data"]),
      serious_side_effects: Array.isArray(data.serious_side_effects) ? data.serious_side_effects :
                           (data.serious_side_effects ? [data.serious_side_effects] : ["No serious side effects data"]),
      contraindications: Array.isArray(data.contraindications) ? data.contraindications :
                        (data.contraindications ? [data.contraindications] : ["None specified"]),
      safe_age_groups: Array.isArray(data.safe_age_groups) ? data.safe_age_groups :
                      (data.safe_age_groups ? [data.safe_age_groups] : ["All ages (consult doctor for children)"]),
      pregnancy_and_lactation: data.pregnancy_and_lactation ||
                              data.pregnancy_info ||
                              "Consult healthcare professional before use during pregnancy or lactation",
      storage_instructions: data.storage_instructions ||
                           data.storage ||
                           "Store at room temperature, away from moisture and heat",
      prescription_required: typeof data.prescription_required === 'boolean' ?
                            data.prescription_required :
                            (data.prescription_required === 'true' ||
                             data.prescription_required === 'yes' ||
                             data.prescription_required === 'required'),
      disclaimer: data.disclaimer ||
                  "This information is for educational purposes only. Always consult with a healthcare professional before taking any medication.",
      dosage: data.dosage || data.recommended_dosage || "Consult your healthcare provider",
      mechanism_of_action: data.mechanism_of_action || data.moa || "Not specified",
      drug_interactions: Array.isArray(data.drug_interactions) ? data.drug_interactions : [],
      warnings: data.warnings || data.precautions || [],
      half_life: data.half_life || data.duration_of_action || "Not specified"
    };

    return normalized;
  }, []);

  const parseMedicineData = useCallback((data) => {
    try {
      console.log("parseMedicineData input:", data);
      
      let parsedData = data;
      if (typeof data === 'string') {
        try {
          parsedData = JSON.parse(data);
        } catch (e) {
          return null;
        }
      }
      
      if (parsedData && typeof parsedData === 'object' && !Array.isArray(parsedData)) {
        console.log("Parsed data structure:", Object.keys(parsedData));
        
        // Check for combined response structure
        if (parsedData.medicine_details && parsedData.pricing_and_generics) {
          console.log("Found combined response structure");
          const medicineDetails = normalizeMedicineData(parsedData.medicine_details);
          const pricingAndGenerics = normalizePricingData(parsedData.pricing_and_generics);
          return {
            ...medicineDetails,
            pricing_and_generics: pricingAndGenerics,
            isCombinedResponse: true
          };
        }
        
        if (parsedData.name || parsedData.medicine_name || parsedData.drug_name) {
          console.log("Found medicine-only structure");
          const medicineDetails = normalizeMedicineData(parsedData);
          
          if (parsedData.brand_pricing || parsedData.generic_alternatives) {
            const pricingAndGenerics = normalizePricingData(parsedData);
            return {
              ...medicineDetails,
              pricing_and_generics: pricingAndGenerics,
              isCombinedResponse: true
            };
          }
          
          return medicineDetails;
        }
        
        if (parsedData.details && typeof parsedData.details === 'object') {
          console.log("Found details field structure");
          return parseMedicineData(parsedData.details);
        }
        
        if (parsedData.reply && typeof parsedData.reply === 'object') {
          console.log("Found reply field structure");
          return parseMedicineData(parsedData.reply);
        }
        
        if (parsedData.present === true && parsedData.details) {
          console.log("Found present=true with details structure");
          return parseMedicineData(parsedData.details);
        }
      }

      return null;
    } catch (error) {
      console.error("Error parsing medicine data:", error, data);
      return null;
    }
  }, [normalizeMedicineData, normalizePricingData]);

  const normalizeChatMessages = useCallback((messages) => {
    if (!Array.isArray(messages)) return [];

    return messages.map(message => {
      const content = message.content;
      const parsedContent = tryParseJSON(content);
      
      if (parsedContent && typeof parsedContent === 'object' && !Array.isArray(parsedContent)) {
        if (parsedContent.medicine_details && parsedContent.pricing_and_generics) {
          const medicineData = parseMedicineData(parsedContent);
          if (medicineData) {
            return {
              ...message,
              content: null,
              medicineData: medicineData,
              isMedicineData: true
            };
          }
        } else if (parsedContent.name || parsedContent.medicine_name || parsedContent.drug_name) {
          const medicineData = parseMedicineData(parsedContent);
          if (medicineData) {
            return {
              ...message,
              content: null,
              medicineData: medicineData,
              isMedicineData: true
            };
          }
        }
      }
      
      return {
        ...message,
        content: parsedContent || content,
        medicineData: null,
        isMedicineData: false
      };
    });
  }, [tryParseJSON, parseMedicineData]);

  const isValidThreadId = useCallback((id) => {
    if (!id) return false;
    if (typeof id !== "string") return false;
    const trimmed = id.trim();
    if (!trimmed) return false;
    if (trimmed === "undefined" || trimmed === "null") return false;
    return true;
  }, []);

  // Memoized parsed medicine data
  const parsedMedicineData = useMemo(() => 
    parseMedicineData(reply), 
    [reply, parseMedicineData]
  );

  // Debounced getReply function
  const debouncedGetReply = useMemo(
    () => debounce(() => getReply(), 500),
    []
  );

  // Clean up debounce on unmount
  useEffect(() => {
    return () => {
      debouncedGetReply.cancel();
    };
  }, [debouncedGetReply]);

  const fetchThreads = useCallback(async () => {
    setFetchingThreads(true);
    try {
      const res = await api.get("/api/thread");
      const data = res?.data ?? res;
      const threads = Array.isArray(data?.threads)
        ? data.threads
        : Array.isArray(data)
        ? data
        : Array.isArray(data?.data)
        ? data.data
        : [];

      const history = threads
        .map(t => {
          const title = t?.title || "";
          const lastMessage = t?.messages?.[t.messages?.length - 1]?.content || "";
          return title || lastMessage;
        })
        .filter(title => title && title.trim().length > 0)
        .slice(0, 10);

      setSearchHistory(history);
      setAllThreads(threads);
    } catch (err) {
      console.error("Failed to fetch threads:", err);
      setAllThreads([]);
      setSearchHistory([]);
    } finally {
      setFetchingThreads(false);
    }
  }, [setAllThreads]);

  useEffect(() => {
    if (user?.id || user?.email) {
      fetchThreads();
    } else {
      setAllThreads([]);
      setSearchHistory([]);
    }
  }, [user?.id, user?.email, fetchThreads, setAllThreads]);

  const callChatApi = async (payload) => {
    if (!isOnline) {
      throw new Error("You are offline. Please check your internet connection.");
    }
    
    const res = await api.post("/api/chat", payload);
    return res?.data ?? {};
  };

  // ✅ FIXED getReply - NO MORE MOCK DATA
  const getReply = useCallback(async () => {
    const text = (prompt || "").trim();
    if (!text) return;

    setLoading(true);
    setReply(null);

    if (text && !searchHistory.includes(text)) {
      setSearchHistory(prev => [text, ...prev.slice(0, 9)]);
    }

    const payload0 = { message: text };
    if (!newChat && isValidThreadId(currThreadId)) payload0.threadId = currThreadId;

    try {
      let data;
      try {
        data = await callChatApi(payload0);
        console.log("=== BACKEND RESPONSE ===");
        console.log(JSON.stringify(data, null, 2));
        console.log("========================");
      } catch (err) {
        const status = err?.response?.status;
        if (status === 404) {
          setNewChat(true);
          data = await callChatApi({ message: text });
        } else {
          throw err;
        }
      }

      if (data?.threadId && isValidThreadId(data.threadId)) {
        setCurrThreadId(data.threadId);
        setNewChat(false);
      }

      // Try to parse the medicine data
      let medicineData = parseMedicineData(data?.reply || data?.data || data?.details || data?.message || data);
      
      console.log("=== PARSED MEDICINE DATA ===");
      console.log("Has medicine data?", !!medicineData);
      console.log("Has pricing data?", !!medicineData?.pricing_and_generics);
      console.log("============================");

      // ✅ CRITICAL FIX: DO NOT ADD MOCK DATA
      // Let the backend provide real pricing data
      // If backend doesn't have pricing, show medicine info without it
      
      if (medicineData) {
        // Backend provided medicine data
        setReply(medicineData);
        
        const newMessages = [
          ...prevChats,
          { role: "user", content: text, isMedicineData: false },
          { role: "assistant", content: null, medicineData: medicineData, isMedicineData: true }
        ];
        setPrevChats(newMessages);
        
        // Warn if no pricing data (for debugging)
        if (!medicineData.pricing_and_generics) {
          console.warn("⚠️ Backend did not return pricing data for:", medicineData.name);
          console.warn("Check that getMedicineDetails returns pricing_and_generics field");
        }
      } else {
        // Not medicine data - regular text response
        const assistantReply = data?.reply || data?.message || "No response available";
        setReply(assistantReply);
        
        const newMessages = [
          ...prevChats,
          { role: "user", content: text, isMedicineData: false },
          { role: "assistant", content: assistantReply, medicineData: null, isMedicineData: false }
        ];
        setPrevChats(newMessages);
      }

      await fetchThreads();
    } catch (err) {
      console.error("Chat request failed:", err);
      const status = err?.response?.status;
      const body = err?.response?.data;

      let errorMessage = "Network or server error";
      if (!isOnline) {
        errorMessage = "You are offline. Please check your internet connection.";
      } else if (status === 401 || status === 403) {
        errorMessage = "Authentication error. Please sign in again.";
      } else if (body && body.error) {
        errorMessage = body.error;
      } else if (err.message) {
        errorMessage = err.message;
      }

      setPrevChats(prev => [
        ...prev,
        { role: "user", content: text, isMedicineData: false },
        { role: "assistant", content: `Error: ${errorMessage}`, medicineData: null, isMedicineData: false }
      ]);
    } finally {
      setLoading(false);
    }
  }, [
    prompt, 
    searchHistory, 
    newChat, 
    currThreadId, 
    isValidThreadId, 
    parseMedicineData, 
    prevChats, 
    fetchThreads, 
    setReply, 
    setNewChat, 
    setCurrThreadId, 
    setPrevChats, 
    setLoading,
    isOnline
  ]);

  const loadThread = useCallback(async (threadId) => {
    if (!isValidThreadId(threadId)) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/thread/${encodeURIComponent(threadId)}`);
      const data = res?.data ?? {};
      const thread = data?.thread ?? data;
      if (!thread) {
        alert("Thread not found.");
        return;
      }

      const messages = Array.isArray(thread.messages) ? thread.messages : [];
      const normalizedMessages = normalizeChatMessages(messages);
      setPrevChats(normalizedMessages);
      setCurrThreadId(thread.threadId || threadId);
      setNewChat(false);
      setReply(null);
    } catch (err) {
      console.error("Failed to load thread:", err);
      alert("Failed to load conversation. See console for details.");
    } finally {
      setLoading(false);
    }
  }, [isValidThreadId, normalizeChatMessages, setPrevChats, setCurrThreadId, setNewChat, setReply]);

  // Normalize existing messages on mount
  useEffect(() => {
    if (prevChats.length > 0) {
      const hasUnnormalizedMessages = prevChats.some(msg =>
        msg.role === "assistant" &&
        typeof msg.content === "string" &&
        msg.content.trim().startsWith("{") &&
        msg.content.trim().endsWith("}") &&
        !msg.medicineData
      );

      if (hasUnnormalizedMessages) {
        const normalizedMessages = normalizeChatMessages(prevChats);
        setPrevChats(normalizedMessages);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSignOut = useCallback(async () => {
    const confirmed = window.confirm("Sign out of PharmaAssist?");
    if (!confirmed) return;

    try {
      if (typeof signOut === "function") {
        await signOut();
      } else {
        try {
          localStorage.removeItem("authToken");
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          delete api.defaults.headers.common["Authorization"];
        } catch (e) {
          console.warn("Fallback signOut cleanup failed:", e);
        }
      }

      setPrompt("");
      setReply(null);
      setPrevChats([]);
      setNewChat(true);
      setAllThreads([]);
      setSearchHistory([]);
      setCurrThreadId(undefined);

      setIsProfileOpen(false);
      navigate("/login", { replace: true });
    } catch (err) {
      console.error("Sign out error:", err);
      alert("Failed to sign out. See console for details.");
    }
  }, [signOut, navigate, setPrompt, setReply, setPrevChats, setNewChat, setAllThreads, setSearchHistory, setCurrThreadId]);

  const toggleProfile = () => setIsProfileOpen((s) => !s);
  const toggleRecent = () => setRecentOpen((s) => !s);

  const renderMessageContent = useCallback((message) => {
    if (message.role === "user") {
      return <p className="font-medium">{message.content}</p>;
    } else if (message.isMedicineData && message.medicineData) {
      if (message.medicineData.pricing_and_generics) {
        return (
          <>
            <MedicineCard data={message.medicineData} />
            <PricingCard data={message.medicineData.pricing_and_generics} />
          </>
        );
      }
      return <MedicineCard data={message.medicineData} />;
    } else {
      const content = message.content || "";
      const parsed = tryParseJSON(content);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const medicineData = parseMedicineData(parsed);
        if (medicineData) {
          if (medicineData.pricing_and_generics) {
            return (
              <>
                <MedicineCard data={medicineData} />
                <PricingCard data={medicineData.pricing_and_generics} />
              </>
            );
          }
          return <MedicineCard data={medicineData} />;
        }
      }
      return (
        <div className="prose prose-sm max-w-none text-gray-900">
          {content}
        </div>
      );
    }
  }, [tryParseJSON, parseMedicineData]);

  // Event listener for new chat
  useEffect(() => {
    const handleNewChat = () => {
      setPrompt("");
      setReply(null);
      setNewChat(true);
      setCurrThreadId(undefined);
      setPrevChats([]);
    };

    window.addEventListener('new-chat', handleNewChat);
    return () => window.removeEventListener('new-chat', handleNewChat);
  }, [setPrompt, setReply, setNewChat, setCurrThreadId, setPrevChats]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white text-gray-800 flex flex-col">
      {/* Online Status Indicator */}
      {!isOnline && (
        <div className="bg-red-100 border-b border-red-200 py-2 px-4 text-center" role="alert">
          <p className="text-sm text-red-700">
            <svg className="w-4 h-4 inline mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
            </svg>
            You are offline. Some features may be unavailable.
          </p>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-blue-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="bg-blue-600 w-10 h-10 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-blue-800">PharmaAssist</h1>
                  <p className="text-sm text-blue-600 hidden sm:block">AI-Powered Medication Intelligence</p>
                </div>
              </div>
            </div>

            {/* Profile */}
            <div className="relative">
              <button
                onClick={toggleProfile}
                aria-haspopup="true"
                aria-expanded={isProfileOpen}
                className="flex items-center gap-3 bg-white hover:bg-blue-50 px-4 py-2 rounded-xl border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              >
                <span className="sr-only">Open profile menu</span>
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-gray-900">{user?.name ?? "Researcher"}</p>
                  <p className="text-xs text-blue-600">{user?.email ?? "user@domain"}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-medium">
                  {user?.name ? user.name.split(" ").map((n) => n[0]).slice(0, 2).join("") : "PA"}
                </div>
              </button>

              {isProfileOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-blue-200 rounded-xl shadow-lg z-20 overflow-hidden">
                  <div className="p-4 border-b border-blue-100">
                    <p className="font-medium text-gray-900">{user?.name ?? "Researcher"}</p>
                    <p className="text-sm text-blue-600">{user?.email ?? "user@domain"}</p>
                  </div>

                  <button onClick={() => alert("Account settings coming soon.")} className="w-full text-left px-4 py-3 hover:bg-blue-50 flex items-center gap-3 text-gray-700 transition-colors">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <span className="text-sm">Account Settings</span>
                  </button>

                  <div className="border-t border-blue-100">
                    <button onClick={handleSignOut} className="w-full text-left px-4 py-3 hover:bg-blue-50 flex items-center gap-3 text-red-600 transition-colors">
                      <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                        <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                      </div>
                      <span className="text-sm">Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 overflow-hidden">
        <div className="max-w-6xl mx-auto h-full flex flex-col">
          {/* Recent searches */}
          <div className="px-6 pt-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">Recent searches</h2>
              <div className="flex items-center gap-2">
                <button onClick={fetchThreads} className="text-xs px-2 py-1 bg-white border border-blue-100 rounded hover:bg-blue-50">
                  Refresh
                </button>
                <button onClick={toggleRecent} className="text-xs px-2 py-1 bg-white border border-blue-100 rounded hover:bg-blue-50">
                  {recentOpen ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {recentOpen && (
              <div className="mt-3 bg-white border border-blue-100 rounded-lg p-3 max-h-36 overflow-auto">
                {fetchingThreads ? (
                  <MessageSkeleton />
                ) : searchHistory.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {searchHistory.map((query, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          setPrompt(query);
                          setTimeout(() => getReply(), 100);
                        }}
                        className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-sm border border-blue-200 transition-colors"
                      >
                        {query.length > 30 ? `${query.substring(0, 30)}...` : query}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">No recent searches yet. Ask about a medicine to start.</div>
                )}
              </div>
            )}
          </div>

          {/* Chat area */}
          <div className="flex-1 overflow-auto p-6">
            <div className="space-y-6 max-w-4xl mx-auto">
              {prevChats.map((chat, idx) => (
                <div
                  key={idx}
                  className={`flex ${chat.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-4xl ${
                      chat.role === "user"
                        ? "bg-blue-600 text-white rounded-2xl rounded-br-none p-4"
                        : (chat.isMedicineData || chat.medicineData)
                          ? "bg-transparent border-0 shadow-none w-full"
                          : "bg-white text-gray-800 border border-gray-200 rounded-2xl rounded-bl-none p-4"
                    }`}
                  >
                    {renderMessageContent(chat)}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white max-w-xl rounded-2xl p-4 shadow-lg border border-gray-200">
                    <div className="flex items-center gap-3">
                      <ScaleLoader color="#2563eb" height={16} width={2} />
                      <span className="text-sm text-gray-600">Searching medication database...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Info row */}
          <div className="px-6 pb-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-700 text-center">
                <span className="font-semibold">Important:</span> PharmaAssist provides medication information for research purposes only. Always consult healthcare professionals for medical advice.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Input Section */}
      <InputArea
        prompt={prompt}
        setPrompt={setPrompt}
        getReply={getReply}
        loading={loading}
        isListening={isListening}
        isSpeechSupported={isSpeechSupported}
        permissionDenied={permissionDenied}
        toggleMicrophone={toggleMicrophone}
        debouncedGetReply={debouncedGetReply}
      />
    </div>
  );
}

ChatWindow.propTypes = {};

export default ChatWindow;