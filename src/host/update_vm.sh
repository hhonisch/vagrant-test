#!/bin/bash
set -euo pipefail
IFS=$'\n\t'
SCRIPT_DIR=$(dirname $BASH_SOURCE)

# Error handling
failure() {
  local lineno=$1
  local msg=$2
  echo -e "\n*** Failed at line $lineno: $msg"
  exit 1
}
trap 'failure ${LINENO} "$BASH_COMMAND"' ERR

# Include common stuff
source $SCRIPT_DIR/common.sh

# Download tools for setup
downloadTools() {
  local TOOLS_DIR=$1
  
  # Download "sdelete"
  echo "Downloading Sysinternals SDelete..."
  local SDELETE_URL=https://download.sysinternals.com/files/SDelete.zip
  (cd $TOOLS_DIR && curl -o a.zip $SDELETE_URL && unzip -o a.zip && rm a.zip)
}


# Display usage
display_usage() { 
  echo -e "Usage: $0 NAME USER PASSWORD SRC_DIR\n" 
  echo "Update virtual machine after operating system installation"
  echo "NAME:     Name of VM"
  echo "USER:     Username for VM logon"
  echo "PASSWORD: Password for VM logon"
  echo "SRC_DIR:  Directory with files to copy to VM and run"
  echo ""
}


### Main code starts here

# Check for -h or --help
if [[ ( $@ == "--help") ||  $@ == "-h" ]]
then
  display_usage
  exit 0
fi

# Check for correct number of arguments
if [  $# -ne 4 ]
then
  display_usage
  exit 1
fi

# Read params
VM_NAME=$1
VM_USER=$2
VM_PASSWORD=$3
VM_SRC_DIR=$4


echo "**************************************"
echo "*** Updating VM $VM_NAME after operating system install"
echo "**************************************"

# Download tools for setup
downloadTools $(VM_SRC_DIR)

# Startup VM
echo "Starting VM $VM_NAME..."
VBoxManage startvm $VM_NAME --type headless
echo "Waiting for startup to complete..."
VBoxManage guestproperty wait $VM_NAME "/VirtualBox/GuestInfo/OS/NoLoggedInUsers" --timeout 36000000 --fail-on-timeout
sleep 5

# Run update
echo "Copying update files from $VM_SRC_DIR to VM..."
VBoxManage guestcontrol $VM_NAME mkdir --username=$VM_USER --password=$VM_PASSWORD "C:\\temp" 
VBoxManage guestcontrol $VM_NAME copyto --username=$VM_USER --password=$VM_PASSWORD --target-directory "C:\\Temp" $VM_SRC_DIR

echo "Starting update..."
VM_SRC_DIR_BASE=$(basename $VM_SRC_DIR)
VBoxManage guestcontrol $VM_NAME run --username=$VM_USER --password=$VM_PASSWORD --exe cmd.exe -- /c "C:\\Temp\\$VM_SRC_DIR_BASE\\run_update.bat"

# Wait until VM is stopped
waitUntilVmStopped $VM_NAME

echo "Done"