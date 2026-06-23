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

    type RootQuery {
        lifts: [Lift!]!
        userLifts: [Lift!]!
        User: [User!]!
        leaderboard: Leaderboard!
        login(email: String!, password: String!): AuthData!
    }

    type RootMutation {
        createLift(liftInput: LiftInput): Lift
        createUser(userInput: UserInput): User
        deleteLift(liftId: ID!): Lift
        editLift(liftId: ID!, liftInput: LiftInput): Lift
        logSession(liftId: ID!, weight: Int!, seconds: Int): Lift
        parseWorkoutNotes(text: String!, library: [String!]): String!
    }

    schema {
        query: RootQuery
        mutation: RootMutation
    }

`);