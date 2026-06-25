const { buildSchema } = require('graphql');

module.exports = buildSchema(`
    
    type Session {
        weight: Int!
        date: String!
        seconds: Int!
    }

    type Lift {
        _id: ID!
        name: String!
        weight: Int
        sets: Int!
        reps: Int!
        type: String!
        creator: User!
        pastWeights: [Int!]
        sessions: [Session!]
    }

    type User {
        _id: ID!
        email: String!
        password: String!
        createdLifts: [Lift!]
    }

    type AuthData {
        userId: ID!
        token: String!
        tokenExpiration: Int!
    }

    type LeaderEntry {
        username: String!
        score: Int!
    }

    type Leaderboard {
        total: Int!
        rank: Int!
        percentile: Int!
        score: Int!
        ranked: Boolean!
        sessionsLogged: Int!
        sessionsNeeded: Int!
        top: [LeaderEntry!]!
    }

    input UserInput {
        email: String!
        password: String!
    }

    input LiftInput {
        name: String!
        weight: Int
        sets: Int!
        reps: Int!
        type: String!
    }

    type BodyEntry { date: String! weight: Float! }
    type UserBody { entries: [BodyEntry!]! goal: Float }

    type WorkoutLogLift { name: String! type: String! }
    type WorkoutLog {
        date: String!
        mode: String!
        deload: Boolean
        pushIt: Boolean
        durationSec: Int!
        doneSets: Int!
        totalSets: Int!
        volume: Int!
        lifts: [WorkoutLogLift!]!
        prs: [String!]!
    }
    input WorkoutLogLiftInput { name: String! type: String! }
    input WorkoutLogInput {
        date: String!
        mode: String!
        deload: Boolean
        pushIt: Boolean
        durationSec: Int!
        doneSets: Int!
        totalSets: Int!
        volume: Int!
        lifts: [WorkoutLogLiftInput!]!
        prs: [String!]!
    }

    type RootQuery {
        lifts: [Lift!]!
        userLifts: [Lift!]!
        User: [User!]!
        leaderboard: Leaderboard!
        login(email: String!, password: String!): AuthData!
        userBody: UserBody!
        workoutHistory: [WorkoutLog!]!
    }

    type RootMutation {
        createLift(liftInput: LiftInput): Lift
        createUser(userInput: UserInput): User
        deleteLift(liftId: ID!): Lift
        editLift(liftId: ID!, liftInput: LiftInput): Lift
        logSession(liftId: ID!, weight: Int!, seconds: Int): Lift
        parseWorkoutNotes(text: String!, library: [String!]): String!
        logBodyweight(weight: Float!, date: String): UserBody!
        removeBodyweight(date: String!): UserBody!
        setBodyweightGoal(goal: Float): UserBody!
        logWorkout(workout: WorkoutLogInput!): [WorkoutLog!]!
    }

    schema {
        query: RootQuery
        mutation: RootMutation
    }

`);