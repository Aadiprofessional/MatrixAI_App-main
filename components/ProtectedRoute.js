import React, { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../hooks/useAuth';
import { View, ActivityIndicator } from 'react-native';

/**
 * ProtectedRoute component that ensures only authenticated users can access certain screens
 * Automatically redirects to login if user is not authenticated
 */
const ProtectedRoute = ({ children, fallbackScreen = 'Login' }) => {
    const { uid, loading } = useAuth();
    const navigation = useNavigation();

    useEffect(() => {
        // If not loading and no uid, redirect to login
        if (!loading && !uid) {
            console.log('ProtectedRoute: User not authenticated, redirecting to login');
            navigation.reset({
                index: 0,
                routes: [{ name: fallbackScreen }],
            });
        }
    }, [uid, loading, navigation, fallbackScreen]);

    // Show loading while checking authentication
    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#0000ff" />
            </View>
        );
    }

    // If user is authenticated, render the children
    if (uid) {
        return children;
    }

    // If not authenticated and not loading, don't render anything
    // (navigation will handle the redirect)
    return null;
};

export default ProtectedRoute;

/**
 * Higher-order component version for easier use with screen components
 */
export const withProtectedRoute = (ScreenComponent, fallbackScreen = 'Login') => {
    return (props) => (
        <ProtectedRoute fallbackScreen={fallbackScreen}>
            <ScreenComponent {...props} />
        </ProtectedRoute>
    );
};

/**
 * List of screens that should be protected (require authentication)
 */
export const PROTECTED_SCREENS = [
    'Home',
    'AIShop',
    'Profile',
    'BotScreen',
    'SpeechToTextScreen',
    'ImageTextScreen',
    'CreateVideoScreen',
    'PPTGenerateScreen',
    'ProductDetail',
    'FillInformationScreen',
    'PaymentSuccess',
    'ReferralScreen',
    'SubscriptionScreen',
    'TransactionScreen',
    'SettingsScreen',
    'EditProfile',
    'CustomerSupportScreen',
    'OrderHistoryScreen',
    'HelpScreen',
    'FeedbackScreen',
    'AIImageGeneratorScreen',
    'AIVideoGeneratorScreen',
    'AIAudioGeneratorScreen',
    'AIChatScreen',
    'AICodeGeneratorScreen',
    'AIWritingAssistantScreen',
    'AITranslatorScreen',
    'AISummarizerScreen',
    'AIGrammarCheckerScreen',
    'AIContentGeneratorScreen',
    'AIEmailGeneratorScreen',
    'AISocialMediaGeneratorScreen',
    'AIBlogGeneratorScreen',
    'AIProductDescriptionGeneratorScreen',
    'AIResumeGeneratorScreen',
    'AICoverLetterGeneratorScreen',
    'AIBusinessPlanGeneratorScreen',
    'AIMarketingPlanGeneratorScreen',
    'AISEOContentGeneratorScreen',
    'AIAdCopyGeneratorScreen',
    'AINewsletterGeneratorScreen',
    'AIPressReleaseGeneratorScreen',
    'AIScriptGeneratorScreen',
    'AISongLyricsGeneratorScreen',
    'AIPoemGeneratorScreen',
    'AIStoryGeneratorScreen',
    'AIJokeGeneratorScreen',
    'AIQuoteGeneratorScreen',
    'AIMotivationalSpeechGeneratorScreen',
    'AIPickupLineGeneratorScreen',
    'AIRoastGeneratorScreen',
    'AIComplimentGeneratorScreen',
    'AIExcuseGeneratorScreen',
    'AIApologyGeneratorScreen',
    'AIThankYouNoteGeneratorScreen',
    'AIInvitationGeneratorScreen',
    'AIAnnouncementGeneratorScreen',
    'AIReminderGeneratorScreen',
    'AIToDoListGeneratorScreen',
    'AIGoalSettingGeneratorScreen',
    'AIHabitTrackerGeneratorScreen',
    'AIMoodTrackerGeneratorScreen',
    'AIJournalPromptGeneratorScreen',
    'AIReflectionPromptGeneratorScreen',
    'AIGratitudePracticeGeneratorScreen',
    'AIMindfulnessExerciseGeneratorScreen',
    'AIRelaxationTechniqueGeneratorScreen',
    'AIBreathingExerciseGeneratorScreen',
    'AIYogaPoseGeneratorScreen',
    'AIWorkoutPlanGeneratorScreen',
    'AIMealPlanGeneratorScreen',
    'AIRecipeGeneratorScreen',
    'AIShoppingListGeneratorScreen',
    'AIBudgetPlanGeneratorScreen',
    'AIInvestmentAdviceGeneratorScreen',
    'AICareerAdviceGeneratorScreen',
    'AIStudyPlanGeneratorScreen',
    'AILearningGoalGeneratorScreen',
    'AISkillAssessmentGeneratorScreen',
    'AIPersonalityTestGeneratorScreen',
    'AICompatibilityTestGeneratorScreen',
    'AIRelationshipAdviceGeneratorScreen',
    'AIParentingAdviceGeneratorScreen',
    'AIPetCareAdviceGeneratorScreen',
    'AIGardeningAdviceGeneratorScreen',
    'AICookingTipsGeneratorScreen',
    'AICleaningTipsGeneratorScreen',
    'AIOrganizationTipsGeneratorScreen',
    'AIProductivityTipsGeneratorScreen',
    'AITimeManagementTipsGeneratorScreen',
    'AIStressManagementTipsGeneratorScreen',
    'AISleepImprovementTipsGeneratorScreen',
    'AIHealthTipsGeneratorScreen',
    'AIFitnessTipsGeneratorScreen',
    'AIBeautyTipsGeneratorScreen',
    'AIFashionAdviceGeneratorScreen',
    'AITravelPlanGeneratorScreen',
    'AIItineraryGeneratorScreen',
    'AIPackingListGeneratorScreen',
    'AIEventPlanGeneratorScreen',
    'AIPartyPlanGeneratorScreen',
    'AIGiftIdeaGeneratorScreen',
    'AIHobbyRecommendationGeneratorScreen',
    'AIBookRecommendationGeneratorScreen',
    'AIMovieRecommendationGeneratorScreen',
    'AIMusicRecommendationGeneratorScreen',
    'AIGameRecommendationGeneratorScreen',
    'AIAppRecommendationGeneratorScreen',
    'AIWebsiteRecommendationGeneratorScreen',
    'AIToolRecommendationGeneratorScreen',
    'AIServiceRecommendationGeneratorScreen',
    'AIProductRecommendationGeneratorScreen',
    'AIRestaurantRecommendationGeneratorScreen',
    'AIActivityRecommendationGeneratorScreen',
    'AIExerciseRecommendationGeneratorScreen',
    'AIDietRecommendationGeneratorScreen',
    'AISupplementRecommendationGeneratorScreen',
    'AIMedicationReminderGeneratorScreen',
    'AIAppointmentReminderGeneratorScreen',
    'AIBirthdayReminderGeneratorScreen',
    'AIAnniversaryReminderGeneratorScreen',
    'AIHolidayReminderGeneratorScreen',
    'AITaskReminderGeneratorScreen',
    'AIDeadlineReminderGeneratorScreen',
    'AIMeetingReminderGeneratorScreen',
    'AICallReminderGeneratorScreen',
    'AIEmailReminderGeneratorScreen',
    'AITextReminderGeneratorScreen',
    'AINotificationGeneratorScreen',
    'AIAlertGeneratorScreen',
    'AIWarningGeneratorScreen',
    'AIErrorMessageGeneratorScreen',
    'AISuccessMessageGeneratorScreen',
    'AIConfirmationMessageGeneratorScreen',
    'AIWelcomeMessageGeneratorScreen',
    'AIGoodbyeMessageGeneratorScreen',
    'AIGreetingGeneratorScreen',
    'AIFarewellGeneratorScreen',
    'AICongratulationsGeneratorScreen',
    'AICondolenceGeneratorScreen',
    'AIGetWellSoonGeneratorScreen',
    'AIBirthdayWishGeneratorScreen',
    'AIAnniversaryWishGeneratorScreen',
    'AIHolidayWishGeneratorScreen',
    'AIGraduationWishGeneratorScreen',
    'AIPromotionWishGeneratorScreen',
    'AIRetirementWishGeneratorScreen',
    'AINewJobWishGeneratorScreen',
    'AINewHomeWishGeneratorScreen',
    'AINewBabyWishGeneratorScreen',
    'AIWeddingWishGeneratorScreen',
    'AIEngagementWishGeneratorScreen',
    'AIValentinesDayWishGeneratorScreen',
    'AIMothersDay'
];