import java.util.Scanner;

// Create a BankAccount
class BankAccount {

    String name;
    int accountNumber;
    double balance;

    // Deposit method
    void deposit(double amount) {
        balance = balance + amount;
        System.out.println("Amount Deposited successfully!");
    }

    // Withdrawal method
    void withdraw(double amount) {
        if (amount <= balance) {
            balance = balance - amount;
            System.out.println("Amount Withdrawn successfully!");
        } else {
            System.out.println("Insufficient balance!");
        }
    }

    // Check balance method
    void checkBalance() {
        System.out.println("Current Balance: ₹" + balance);
    }

    // Display account details
    void displayDetails() {
        System.out.println("\n===== ACCOUNT DETAILS =====");
        System.out.println("Name: " + name);
        System.out.println("Account Number: " + accountNumber);
        System.out.println("Current Balance: ₹" + balance);
    }
}


// Main class
public class BankingSystem {

    public static void main(String[] args) {

        // Input from user
        Scanner sc = new Scanner(System.in);

        // Create an account
        BankAccount account = new BankAccount();

        System.out.println("===== CREATE BANK ACCOUNT =====");

        System.out.print("Enter your name: ");
        account.name = sc.nextLine();

        System.out.print("Enter your account number: ");
        account.accountNumber = sc.nextInt();

        System.out.print("Enter your initial balance: ");
        account.balance = sc.nextDouble();

        // Creating Menu
        int choice;

        do {
            System.out.println("\n===== BANKING SYSTEM =====");
            System.out.println("1. Deposit");
            System.out.println("2. Withdraw");
            System.out.println("3. Check Balance");
            System.out.println("4. Account Details");
            System.out.println("5. Exit");

            System.out.print("Enter your choice: ");
            choice = sc.nextInt();

            switch (choice) {

                case 1:
                    System.out.print("Enter amount to deposit: ");
                    double depositAmount = sc.nextDouble();
                    account.deposit(depositAmount);
                    break;

                case 2:
                    System.out.print("Enter amount to withdraw: ");
                    double withdrawAmount = sc.nextDouble();
                    account.withdraw(withdrawAmount);
                    break;

                case 3:
                    account.checkBalance();
                    break;

                case 4:
                    account.displayDetails();
                    break;

                case 5:
                    System.out.println("Thank you for using our banking system. Goodbye!");
                    break;

                default:
                    System.out.println("Invalid choice! Please try again.");
            }

        } while (choice != 5);

        sc.close();
    }
}